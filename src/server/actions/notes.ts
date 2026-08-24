"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { parseMoneyToCents } from "@/lib/money";
import { isSupportedCurrency } from "@/lib/currencies";
import { fail, succeed, type ActionState } from "./types";

const schema = z.object({
  description: z.string().trim().min(1, "Add a description.").max(120),
  amount: z.string().trim().min(1, "Enter an amount."),
  currency: z.string().trim().length(3),
  date: z.string().trim().min(1),
  direction: z.enum(["GAVE", "RECEIVED", "SPENT"]),
  category: z.string().trim().min(1).default("general"),
  aboutUserId: z.string().trim().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function createNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = schema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    currency: formData.get("currency") ?? user.defaultCurrency,
    date: formData.get("date"),
    direction: formData.get("direction") ?? "SPENT",
    category: formData.get("category") || "general",
    aboutUserId: formData.get("aboutUserId") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.");

  const currency = parsed.data.currency.toUpperCase();
  if (!isSupportedCurrency(currency)) return fail("Pick a supported currency.");

  const amountCents = parseMoneyToCents(parsed.data.amount, currency);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return fail("Enter an amount greater than zero.");
  }

  const aboutUserId = parsed.data.aboutUserId || null;
  if (aboutUserId) {
    // Only somebody you actually know, so the picker can't be used to probe ids.
    const known = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId: user.id, friendId: aboutUserId } },
      select: { id: true },
    });
    if (!known) return fail("Pick somebody from your friends list.");
  }

  const date = new Date(`${parsed.data.date}T12:00:00`);

  await prisma.personalNote.create({
    data: {
      userId: user.id,
      aboutUserId,
      direction: parsed.data.direction,
      description: parsed.data.description,
      amountCents,
      currency,
      date: Number.isNaN(date.getTime()) ? new Date() : date,
      category: parsed.data.category,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/notes");
  // Added from somebody's own page? Go back there, not to the full list.
  if (aboutUserId) revalidatePath(`/notes/person/${aboutUserId}`);
  redirect(aboutUserId ? `/notes/person/${aboutUserId}` : "/notes");
}

export async function deleteNoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("noteId") ?? "");
  if (!id) return fail("Missing note.");

  // Scoped to the owner — nobody else can even see these.
  const note = await prisma.personalNote.findFirst({
    where: { id, userId: user.id },
    select: { aboutUserId: true },
  });
  if (!note) return fail("That note is not yours to delete.");

  await prisma.personalNote.delete({ where: { id } });

  revalidatePath("/notes");
  if (note.aboutUserId) revalidatePath(`/notes/person/${note.aboutUserId}`);
  return succeed("Note deleted.");
}
