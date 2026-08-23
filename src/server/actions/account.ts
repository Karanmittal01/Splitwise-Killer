"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { normalisePhone, phoneVariants } from "@/lib/people";
import { isSupportedCurrency } from "@/lib/currencies";
import { fail, succeed, type ActionState } from "./types";

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const currency = String(formData.get("defaultCurrency") ?? "").toUpperCase();

  if (name.length === 0) return fail("Your name can't be empty.");
  if (!isSupportedCurrency(currency)) return fail("Pick a supported currency.");

  const phone = phoneRaw ? normalisePhone(phoneRaw) : null;
  if (phoneRaw && !phone) return fail("That mobile number doesn't look right.");

  if (phone) {
    const clash = await prisma.user.findFirst({
      where: { phone: { in: phoneVariants(phone) }, NOT: { id: user.id } },
      select: { id: true, isPlaceholder: true },
    });
    if (clash) {
      return fail(
        clash.isPlaceholder
          ? "Somebody already invited that number. Open the invite link they sent you to merge the accounts."
          : "That mobile number is already on another account.",
      );
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name, phone, defaultCurrency: currency },
  });

  revalidatePath("/account");
  revalidatePath("/dashboard");
  return succeed("Profile saved.");
}

const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024;

/**
 * Save an uploaded profile picture.
 *
 * The browser shrinks the image to 256px before sending it (see AvatarUpload),
 * so what lands here is a few tens of kilobytes rather than a 4 MB phone photo.
 * The size limit below is the backstop for anything that bypasses that.
 */
export async function updateAvatarAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) return fail("Choose a picture first.");
  if (!file.type.startsWith("image/")) return fail("That file isn't an image.");
  if (file.size > MAX_AVATAR_BYTES) {
    return fail("That picture is too large. Try a smaller one.");
  }

  const data = Buffer.from(await file.arrayBuffer());
  await prisma.profileImage.upsert({
    where: { userId: user.id },
    create: { userId: user.id, mimeType: file.type, size: file.size, data },
    update: { mimeType: file.type, size: file.size, data },
  });

  // Point the account at the new picture. The ?v stamp busts any cached copy
  // of the previous one, in browsers and in Next's image cache alike.
  await prisma.user.update({
    where: { id: user.id },
    data: { image: `/api/avatars/${user.id}?v=${Date.now()}` },
  });

  revalidatePath("/account");
  revalidatePath("/dashboard");
  return succeed("Profile picture updated.");
}

/** Remove an uploaded picture, falling back to initials. */
export async function removeAvatarAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  await prisma.profileImage.deleteMany({ where: { userId: user.id } });
  await prisma.user.update({ where: { id: user.id }, data: { image: null } });

  revalidatePath("/account");
  revalidatePath("/dashboard");
  return succeed("Profile picture removed.");
}
