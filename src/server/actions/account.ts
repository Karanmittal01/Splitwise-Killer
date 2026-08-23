"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { normalisePhone } from "@/lib/people";
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
      where: { phone, NOT: { id: user.id } },
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
