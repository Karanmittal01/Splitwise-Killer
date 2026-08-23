import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * Serves an uploaded profile picture. Signed-in only — avatars are shown to
 * the people you split with, not to the open internet.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Unauthorized", { status: 401 });

  const { userId } = await params;
  const image = await prisma.profileImage.findUnique({
    where: { userId },
    select: { data: true, mimeType: true },
  });
  if (!image) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      // The URL carries a ?v= stamp that changes on every upload, so this can
      // be cached hard without ever showing a stale picture.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
