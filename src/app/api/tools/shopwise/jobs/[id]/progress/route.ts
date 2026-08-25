import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { workerOrNull, unauthorised, badRequest } from "@/server/shopwise";

const Progress = z.object({
  phase: z.string().max(64),
  total: z.number().nonnegative().optional(),
  fee: z.number().nonnegative().optional(),
  faceValue: z.number().nonnegative().optional(),
});

/**
 * A phase update from the worker. Also the job's heartbeat — touching the row
 * resets the staleness clock, so a long wait on an OTP is not mistaken for a
 * worker that has died.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!workerOrNull(request)) return unauthorised();

  const parsed = Progress.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Expected { phase }.");
  const { phase, total, fee } = parsed.data;

  const { id } = await params;
  const updated = await prisma.shopwiseJob.updateMany({
    where: { id, status: { in: ["RUNNING", "AWAITING_OTP"] } },
    data: {
      phase,
      ...(total === undefined ? {} : { totalCents: Math.round(total * 100) }),
      ...(fee === undefined ? {} : { feeCents: Math.round(fee * 100) }),
    },
  });
  if (updated.count === 0) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json({ ok: true });
}
