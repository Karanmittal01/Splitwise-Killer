import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ownerOrNull, unauthorised, badRequest } from "@/server/shopwise";

/**
 * Stop a run.
 *
 * A queued job is dropped outright. A running one is marked cancelled and the
 * worker notices the next time it asks about the OTP — which is the only point
 * where it is ever idle long enough to be interrupted safely. A purchase already
 * submitted to the bank cannot be called back from here.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await ownerOrNull();
  if (!user) return unauthorised();

  const { id } = await params;
  const updated = await prisma.shopwiseJob.updateMany({
    where: { id, userId: user.id, status: { in: ["QUEUED", "RUNNING", "AWAITING_OTP"] } },
    data: {
      status: "CANCELLED",
      phase: null,
      otpCode: null,
      otpPurpose: null,
      otpRequestedAt: null,
      finishedAt: new Date(),
    },
  });
  if (updated.count === 0) return badRequest("That run has already finished.");

  return NextResponse.json({ ok: true });
}
