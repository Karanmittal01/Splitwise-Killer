import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { workerOrNull, unauthorised, expireStaleJobs } from "@/server/shopwise";

/**
 * The worker claims the oldest queued job, or gets `{ job: null }` and goes back
 * to sleep.
 *
 * The claim is a guarded `updateMany` rather than a read-then-write: if two
 * workers ever run at once, exactly one of them sees `count === 1` and the other
 * walks away empty-handed instead of both driving the same purchase.
 */
export async function POST(request: Request) {
  if (!workerOrNull(request)) return unauthorised();

  await expireStaleJobs();

  const candidate = await prisma.shopwiseJob.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!candidate) return NextResponse.json({ job: null });

  const claimed = await prisma.shopwiseJob.updateMany({
    where: { id: candidate.id, status: "QUEUED" },
    data: { status: "RUNNING", claimedAt: new Date(), phase: "starting" },
  });
  if (claimed.count === 0) return NextResponse.json({ job: null });

  const job = await prisma.shopwiseJob.findUnique({
    where: { id: candidate.id },
    select: { id: true, mode: true, faceValueCents: true },
  });

  return NextResponse.json({ job });
}
