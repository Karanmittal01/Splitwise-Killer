import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SHOPWISE } from "@/lib/tools";
import {
  ownerOrNull,
  unauthorised,
  badRequest,
  expireStaleJobs,
  liveEligibility,
  publicJob,
} from "@/server/shopwise";

/** Recent jobs, newest first. The Tools page polls this while a run is active. */
export async function GET() {
  const user = await ownerOrNull();
  if (!user) return unauthorised();

  await expireStaleJobs();

  const [jobs, eligibility] = await Promise.all([
    prisma.shopwiseJob.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    liveEligibility(user.id),
  ]);

  return NextResponse.json({
    jobs: jobs.map(publicJob),
    eligibility,
    totalRuns: SHOPWISE.totalRuns,
  });
}

const CreateJob = z.object({ mode: z.enum(["dry", "live"]) });

/** Queue a purchase. The worker picks it up within a poll interval. */
export async function POST(request: Request) {
  const user = await ownerOrNull();
  if (!user) return unauthorised();

  const parsed = CreateJob.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Expected { mode: 'dry' | 'live' }.");
  const { mode } = parsed.data;

  await expireStaleJobs();

  // Only one job in flight: two Chromium sessions on one portal account would
  // fight over the login, and the second would silently log the first out.
  const active = await prisma.shopwiseJob.findFirst({
    where: { userId: user.id, status: { in: ["QUEUED", "RUNNING", "AWAITING_OTP"] } },
    select: { id: true },
  });
  if (active) return badRequest("A run is already in progress.");

  if (mode === "live") {
    const eligibility = await liveEligibility(user.id);
    if (!eligibility.allowed) return badRequest(eligibility.reason);
  }

  const job = await prisma.shopwiseJob.create({
    data: { userId: user.id, mode, faceValueCents: SHOPWISE.faceValueCents },
  });

  return NextResponse.json({ job: publicJob(job) }, { status: 201 });
}
