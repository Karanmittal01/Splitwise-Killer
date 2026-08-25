import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { isOwner } from "@/lib/owner";
import { monthKey, SHOPWISE } from "@/lib/tools";
import type { CurrentUser } from "@/lib/session";

/**
 * Whether a request carries the worker's shared secret.
 *
 * The worker is a separate process on another machine, so it cannot use a
 * session cookie. Compared in constant time: a plain `===` on a secret leaks its
 * prefix through timing, and this token authorises spending money. A token
 * shorter than 16 characters is refused outright rather than trusted.
 */
export function isWorker(request: Request): boolean {
  const expected = process.env.SHOPWISE_WORKER_TOKEN ?? "";
  if (expected.length < 16) return false;

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (presented.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

/**
 * Shared guards and bookkeeping for the Shopwise Tools API.
 *
 * Two callers, two very different credentials: you, holding a session cookie and
 * matching OWNER_EMAIL, and the worker, holding a shared bearer token. Neither
 * route type ever accepts the other's credential.
 */

export const unauthorised = () => new NextResponse("Unauthorized", { status: 401 });
export const notFound = () => new NextResponse("Not found", { status: 404 });
export const badRequest = (message: string) => new NextResponse(message, { status: 400 });

/** Resolves to the signed-in owner, or null when the caller is anybody else. */
export async function ownerOrNull(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return isOwner(user) ? user : null;
}

export function workerOrNull(request: Request): boolean {
  return isWorker(request);
}

/**
 * A job whose worker died stays RUNNING forever and the page waits on a process
 * that is never coming back. Anything untouched for this long is declared dead;
 * the worker's own claim is refreshed on every progress report, so a job that is
 * genuinely alive keeps resetting the clock.
 */
const STALE_AFTER_MS = 20 * 60 * 1000;

export async function expireStaleJobs(): Promise<void> {
  await prisma.shopwiseJob.updateMany({
    where: {
      status: { in: ["RUNNING", "AWAITING_OTP"] },
      updatedAt: { lt: new Date(Date.now() - STALE_AFTER_MS) },
    },
    data: {
      status: "FAILED",
      error: "The worker stopped responding. Check that it is still running, then try again.",
      finishedAt: new Date(),
      otpCode: null,
      otpPurpose: null,
    },
  });
}

export type Eligibility = { allowed: boolean; reason: string; done: number };

/**
 * Whether a live purchase may be queued: one per calendar month, six in total.
 *
 * Successful jobs are the only ones that count, so a failed attempt leaves the
 * month open for a retry — which is exactly what you want when a run dies
 * halfway through for a reason that has nothing to do with you.
 */
export async function liveEligibility(userId: string): Promise<Eligibility> {
  const succeeded = await prisma.shopwiseJob.findMany({
    where: { userId, status: "SUCCEEDED" },
    select: { finishedAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const done = succeeded.length;
  if (done >= SHOPWISE.totalRuns) {
    return { allowed: false, reason: `All ${SHOPWISE.totalRuns} purchases are done.`, done };
  }

  const thisMonth = monthKey();
  const boughtThisMonth = succeeded.some(
    (job) => monthKey(job.finishedAt ?? job.createdAt) === thisMonth,
  );
  if (boughtThisMonth) {
    return { allowed: false, reason: "Already bought this month.", done };
  }

  return { allowed: true, reason: `Purchase ${done + 1} of ${SHOPWISE.totalRuns}.`, done };
}

/** A job as the browser is allowed to see it. */
export function publicJob(job: {
  id: string;
  mode: string;
  status: string;
  phase: string | null;
  faceValueCents: number;
  totalCents: number | null;
  feeCents: number | null;
  orderRef: string | null;
  error: string | null;
  otpPurpose: string | null;
  otpRequestedAt: Date | null;
  otpCode: string | null;
  createdAt: Date;
  finishedAt: Date | null;
}) {
  return {
    id: job.id,
    mode: job.mode,
    status: job.status,
    phase: job.phase,
    faceValueCents: job.faceValueCents,
    totalCents: job.totalCents,
    feeCents: job.feeCents,
    orderRef: job.orderRef,
    error: job.error,
    otpPurpose: job.otpPurpose,
    otpRequestedAt: job.otpRequestedAt?.toISOString() ?? null,
    // Never echo the code back — only whether one is still waiting to be picked up.
    otpPending: job.otpCode !== null,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}
