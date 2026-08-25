import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ownerOrNull, workerOrNull, unauthorised, badRequest, notFound } from "@/server/shopwise";

/**
 * The OTP relay.
 *
 * GET  — the worker collects the code. Reading it deletes it, in one transaction,
 *        so a code exists in the database only for the seconds between you
 *        typing it and the worker picking it up, and can never be replayed.
 * POST — you send the code from the Tools page.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!workerOrNull(request)) return unauthorised();

  const { id } = await params;
  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.shopwiseJob.findUnique({
      where: { id },
      select: { status: true, otpCode: true },
    });
    if (!job) return null;
    if (job.status === "CANCELLED") return { cancelled: true, code: null };
    if (!job.otpCode) return { cancelled: false, code: null };

    await tx.shopwiseJob.update({
      where: { id },
      data: { otpCode: null, otpPurpose: null, otpRequestedAt: null, status: "RUNNING" },
    });
    return { cancelled: false, code: job.otpCode };
  });

  if (!result) return notFound();
  return NextResponse.json(result);
}

const Submit = z.object({ code: z.string().regex(/^\d{4,8}$/, "OTPs are 4 to 8 digits.") });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await ownerOrNull();
  if (!user) return unauthorised();

  const parsed = Submit.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid code.");

  const { id } = await params;
  const updated = await prisma.shopwiseJob.updateMany({
    // Only while something is actually waiting — never park a code on an idle job.
    where: { id, userId: user.id, status: "AWAITING_OTP" },
    data: { otpCode: parsed.data.code },
  });
  if (updated.count === 0) return badRequest("Nothing is waiting for an OTP right now.");

  return NextResponse.json({ ok: true });
}
