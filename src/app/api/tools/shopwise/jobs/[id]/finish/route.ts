import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { workerOrNull, unauthorised, badRequest } from "@/server/shopwise";

const Finish = z.object({
  status: z.enum(["succeeded", "dry_run", "failed"]),
  totalPaise: z.number().int().nonnegative().nullable().optional(),
  feePaise: z.number().int().nonnegative().nullable().optional(),
  orderRef: z.string().max(200).nullable().optional(),
  error: z.string().max(1000).nullable().optional(),
});

const STATUS = {
  succeeded: "SUCCEEDED",
  dry_run: "DRY_RUN",
  failed: "FAILED",
} as const;

/** Terminal report from the worker. Clears any OTP still sitting on the row. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!workerOrNull(request)) return unauthorised();

  const parsed = Finish.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Expected { status }.");
  const { status, totalPaise, feePaise, orderRef, error } = parsed.data;

  const { id } = await params;
  const updated = await prisma.shopwiseJob.updateMany({
    where: { id, status: { in: ["RUNNING", "AWAITING_OTP"] } },
    data: {
      status: STATUS[status],
      totalCents: totalPaise ?? undefined,
      feeCents: feePaise ?? undefined,
      orderRef: orderRef ?? undefined,
      error: error ?? null,
      phase: null,
      otpCode: null,
      otpPurpose: null,
      otpRequestedAt: null,
      finishedAt: new Date(),
    },
  });
  if (updated.count === 0) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json({ ok: true });
}
