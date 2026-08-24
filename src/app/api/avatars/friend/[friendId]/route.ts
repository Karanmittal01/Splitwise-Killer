import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * Serves a picture somebody uploaded for one of their friends.
 *
 * Scoped to the viewer as the owner, not just to "signed in": these are private
 * the way nicknames are, so your picture of Dad is only ever served back to
 * you. Nobody else — including Dad — can reach it.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ friendId: string }> },
) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Unauthorized", { status: 401 });

  const { friendId } = await params;
  const photo = await prisma.friendPhoto.findUnique({
    where: { ownerId_friendId: { ownerId: viewer.id, friendId } },
    select: { data: true, mimeType: true },
  });
  if (!photo) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      // The URL carries a ?v= stamp that changes on every upload, so this can
      // be cached hard without ever showing a stale picture.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
