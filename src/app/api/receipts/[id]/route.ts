import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/** Receipts live in the database, so serving them needs an auth check. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const receipt = await prisma.receipt.findFirst({
    where: {
      id,
      expense: {
        OR: [
          { shares: { some: { userId: user.id } } },
          { group: { members: { some: { userId: user.id } } } },
        ],
      },
    },
    select: { data: true, mimeType: true },
  });
  if (!receipt) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(receipt.data), {
    headers: {
      "Content-Type": receipt.mimeType,
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": "inline",
    },
  });
}
