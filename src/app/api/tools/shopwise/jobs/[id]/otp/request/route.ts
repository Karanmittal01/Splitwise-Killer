import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { workerOrNull, unauthorised, badRequest } from "@/server/shopwise";

const Ask = z.object({ purpose: z.string().max(200) });

/**
 * The worker has hit an OTP prompt and needs you.
 *
 * Any code left over from an earlier step is wiped here, so a stale OTP can
 * never be handed to the next prompt — each request waits for a code typed
 * after it was asked for.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!workerOrNull(request)) return unauthorised();

  const parsed = Ask.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Expected { purpose }.");

  const { id } = await params;
  const updated = await prisma.shopwiseJob.updateMany({
    where: { id, status: { in: ["RUNNING", "AWAITING_OTP"] } },
    data: {
      status: "AWAITING_OTP",
      otpPurpose: parsed.data.purpose,
      otpRequestedAt: new Date(),
      otpCode: null,
    },
  });
  if (updated.count === 0) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json({ ok: true });
}
