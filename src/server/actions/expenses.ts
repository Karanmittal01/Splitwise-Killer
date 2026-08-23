"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { recordActivity } from "@/lib/activity";
import { parseMoneyToCents, formatMoney } from "@/lib/money";
import { isSupportedCurrency } from "@/lib/currencies";
import {
  buildShares,
  computeOwed,
  participantValue,
  SplitError,
  validatePayers,
} from "@/lib/split";
import { advance } from "@/lib/recurring";
import { ensureFriendship } from "@/lib/people";
import { fail, succeed, type ActionState } from "./types";

const MAX_RECEIPT_BYTES = 3 * 1024 * 1024;

const payloadSchema = z.object({
  groupId: z.string().nullable().optional(),
  description: z.string().trim().min(1, "Add a description.").max(120),
  amount: z.string().trim().min(1, "Enter an amount."),
  currency: z.string().trim().length(3),
  date: z.string().trim().min(1),
  category: z.string().trim().min(1).default("general"),
  notes: z.string().trim().max(2000).optional().nullable(),
  splitMethod: z.enum(["EQUAL", "EXACT", "PERCENT", "SHARES", "ADJUSTMENT"]),
  recurrence: z.enum(["NONE", "WEEKLY", "FORTNIGHTLY", "MONTHLY", "YEARLY"]).default("NONE"),
  payers: z
    .array(z.object({ userId: z.string().min(1), amount: z.string() }))
    .min(1, "Somebody has to have paid."),
  participants: z
    .array(z.object({ userId: z.string().min(1), value: z.string().optional() }))
    .min(1, "Pick at least one person to split with."),
});

type Payload = z.infer<typeof payloadSchema>;

/** People the signed-in user is allowed to put on an expense. */
async function allowedParticipantIds(userId: string, groupId: string | null): Promise<Set<string>> {
  if (groupId) {
    const group = await prisma.group.findFirst({
      where: { id: groupId, members: { some: { userId } } },
      select: { members: { select: { userId: true } } },
    });
    if (!group) throw new Error("You are not a member of that group.");
    return new Set(group.members.map((m) => m.userId));
  }

  const [friends, coMembers] = await Promise.all([
    prisma.friendship.findMany({ where: { userId }, select: { friendId: true } }),
    prisma.user.findMany({
      where: { memberships: { some: { group: { members: { some: { userId } } } } } },
      select: { id: true },
    }),
  ]);
  return new Set([userId, ...friends.map((f) => f.friendId), ...coMembers.map((m) => m.id)]);
}

function parsePayload(formData: FormData): Payload {
  const raw = String(formData.get("payload") ?? "");
  if (!raw) throw new SplitError("The form did not submit correctly. Please try again.");
  const parsed = payloadSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new SplitError(parsed.error.issues[0]?.message ?? "Check the form and try again.");
  }
  return parsed.data;
}

/** Shared by create and update: validate everything and shape the share rows. */
async function resolveExpense(payload: Payload, userId: string) {
  const currency = payload.currency.toUpperCase();
  if (!isSupportedCurrency(currency)) throw new SplitError("Pick a supported currency.");

  const totalCents = parseMoneyToCents(payload.amount, currency);
  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    throw new SplitError("Enter an amount greater than zero.");
  }

  const groupId = payload.groupId && payload.groupId !== "" ? payload.groupId : null;
  const allowed = await allowedParticipantIds(userId, groupId);

  const payers = payload.payers.map((p) => ({
    userId: p.userId,
    paidCents: parseMoneyToCents(p.amount.trim() || "0", currency),
  }));
  if (payers.some((p) => !Number.isFinite(p.paidCents))) {
    throw new SplitError("One of the paid amounts is not a number.");
  }
  validatePayers(payers, totalCents);

  const participants = payload.participants.map((p) => ({
    userId: p.userId,
    value: participantValue(payload.splitMethod, p.value, currency),
  }));
  if (participants.some((p) => !Number.isFinite(p.value))) {
    throw new SplitError("One of the split values is not a number.");
  }

  const everyone = [...payers.map((p) => p.userId), ...participants.map((p) => p.userId)];
  for (const id of everyone) {
    if (!allowed.has(id)) throw new SplitError("Somebody on this expense isn't connected to you.");
  }

  const owed = computeOwed(payload.splitMethod, totalCents, participants);
  const shares = buildShares(payers, owed);

  const date = new Date(`${payload.date}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new SplitError("That date doesn't look right.");

  return {
    groupId,
    currency,
    totalCents,
    shares,
    date,
    nextOccurrence: payload.recurrence === "NONE" ? null : advance(date, payload.recurrence),
  };
}

async function saveReceipt(expenseId: string, formData: FormData): Promise<string | null> {
  const file = formData.get("receipt");
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
    return "Receipts must be an image or a PDF.";
  }
  if (file.size > MAX_RECEIPT_BYTES) return "Receipts must be smaller than 3 MB.";

  const data = Buffer.from(await file.arrayBuffer());
  await prisma.receipt.upsert({
    where: { expenseId },
    create: { expenseId, mimeType: file.type, size: file.size, data },
    update: { mimeType: file.type, size: file.size, data },
  });
  return null;
}

export async function createExpenseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  let expenseId: string;
  let groupId: string | null;

  try {
    const payload = parsePayload(formData);
    const resolved = await resolveExpense(payload, user.id);
    groupId = resolved.groupId;

    const expense = await prisma.expense.create({
      data: {
        groupId: resolved.groupId,
        description: payload.description,
        amountCents: resolved.totalCents,
        currency: resolved.currency,
        date: resolved.date,
        category: payload.category,
        notes: payload.notes || null,
        splitMethod: payload.splitMethod,
        recurrence: payload.recurrence,
        nextOccurrence: resolved.nextOccurrence,
        createdById: user.id,
        shares: { create: resolved.shares },
      },
      select: { id: true, description: true, shares: { select: { userId: true } } },
    });
    expenseId = expense.id;

    const receiptError = await saveReceipt(expense.id, formData);
    if (receiptError) return fail(receiptError);

    // A one-on-one expense implies a friendship in both directions.
    if (!resolved.groupId) {
      for (const share of expense.shares) {
        if (share.userId !== user.id) await ensureFriendship(user.id, share.userId);
      }
    }

    const audience = new Set(expense.shares.map((s) => s.userId));
    if (resolved.groupId) {
      const members = await prisma.groupMember.findMany({
        where: { groupId: resolved.groupId },
        select: { userId: true },
      });
      for (const m of members) audience.add(m.userId);
    }

    await recordActivity({
      type: "EXPENSE_ADDED",
      actorId: user.id,
      groupId: resolved.groupId,
      expenseId: expense.id,
      summary: `added "${payload.description}"`,
      detail: formatMoney(resolved.totalCents, resolved.currency),
      audience: [...audience],
    });
  } catch (error) {
    if (error instanceof SplitError) return fail(error.message);
    return fail(error instanceof Error ? error.message : "Could not save the expense.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/activity");
  if (groupId) revalidatePath(`/groups/${groupId}`);
  redirect(groupId ? `/groups/${groupId}` : `/expenses/${expenseId}`);
}

export async function updateExpenseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const expenseId = String(formData.get("expenseId") ?? "");
  if (!expenseId) return fail("Missing expense.");
  let groupId: string | null = null;

  try {
    const existing = await prisma.expense.findFirst({
      where: {
        id: expenseId,
        deletedAt: null,
        OR: [
          { shares: { some: { userId: user.id } } },
          { createdById: user.id },
          { group: { members: { some: { userId: user.id } } } },
        ],
      },
      select: { id: true, isPayment: true, groupId: true },
    });
    if (!existing) return fail("You can't edit this expense.");
    if (existing.isPayment) return fail("Payments can't be edited — delete it and record a new one.");

    const payload = parsePayload(formData);
    const resolved = await resolveExpense(payload, user.id);
    groupId = resolved.groupId;

    await prisma.$transaction([
      prisma.expenseShare.deleteMany({ where: { expenseId } }),
      prisma.expense.update({
        where: { id: expenseId },
        data: {
          groupId: resolved.groupId,
          description: payload.description,
          amountCents: resolved.totalCents,
          currency: resolved.currency,
          date: resolved.date,
          category: payload.category,
          notes: payload.notes || null,
          splitMethod: payload.splitMethod,
          recurrence: payload.recurrence,
          nextOccurrence: resolved.nextOccurrence,
          shares: { create: resolved.shares },
        },
      }),
    ]);

    const receiptError = await saveReceipt(expenseId, formData);
    if (receiptError) return fail(receiptError);

    const audience = new Set(resolved.shares.map((s) => s.userId));
    audience.add(user.id);
    if (resolved.groupId) {
      const members = await prisma.groupMember.findMany({
        where: { groupId: resolved.groupId },
        select: { userId: true },
      });
      for (const m of members) audience.add(m.userId);
    }

    await recordActivity({
      type: "EXPENSE_UPDATED",
      actorId: user.id,
      groupId: resolved.groupId,
      expenseId,
      summary: `updated "${payload.description}"`,
      detail: formatMoney(resolved.totalCents, resolved.currency),
      audience: [...audience],
    });
  } catch (error) {
    if (error instanceof SplitError) return fail(error.message);
    return fail(error instanceof Error ? error.message : "Could not update the expense.");
  }

  revalidatePath("/dashboard");
  revalidatePath(`/expenses/${expenseId}`);
  if (groupId) revalidatePath(`/groups/${groupId}`);
  redirect(`/expenses/${expenseId}`);
}

export async function deleteExpenseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const expenseId = String(formData.get("expenseId") ?? "");
  let groupId: string | null = null;

  try {
    const expense = await prisma.expense.findFirst({
      where: {
        id: expenseId,
        deletedAt: null,
        OR: [
          { shares: { some: { userId: user.id } } },
          { createdById: user.id },
          { group: { members: { some: { userId: user.id } } } },
        ],
      },
      select: {
        id: true,
        description: true,
        groupId: true,
        isPayment: true,
        amountCents: true,
        currency: true,
        shares: { select: { userId: true } },
      },
    });
    if (!expense) return fail("You can't delete this expense.");
    groupId = expense.groupId;

    // Soft delete keeps the activity trail honest and makes restores possible.
    await prisma.expense.update({
      where: { id: expenseId },
      data: { deletedAt: new Date(), recurrence: "NONE", nextOccurrence: null },
    });

    const audience = new Set(expense.shares.map((s) => s.userId));
    audience.add(user.id);
    await recordActivity({
      type: "EXPENSE_DELETED",
      actorId: user.id,
      groupId: expense.groupId,
      summary: `deleted "${expense.description}"`,
      detail: formatMoney(expense.amountCents, expense.currency),
      audience: [...audience],
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not delete the expense.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/activity");
  if (groupId) revalidatePath(`/groups/${groupId}`);
  redirect(groupId ? `/groups/${groupId}` : "/dashboard");
}

export async function addCommentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const expenseId = String(formData.get("expenseId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return fail("Write something first.");
  if (body.length > 1000) return fail("Comments are limited to 1000 characters.");

  const expense = await prisma.expense.findFirst({
    where: {
      id: expenseId,
      deletedAt: null,
      OR: [
        { shares: { some: { userId: user.id } } },
        { group: { members: { some: { userId: user.id } } } },
      ],
    },
    select: { id: true, description: true, groupId: true, shares: { select: { userId: true } } },
  });
  if (!expense) return fail("You can't comment on this expense.");

  await prisma.comment.create({ data: { expenseId, userId: user.id, body } });
  await recordActivity({
    type: "COMMENT_ADDED",
    actorId: user.id,
    groupId: expense.groupId,
    expenseId: expense.id,
    summary: `commented on "${expense.description}"`,
    detail: body.slice(0, 140),
    audience: [...new Set([...expense.shares.map((s) => s.userId), user.id])],
  });

  revalidatePath(`/expenses/${expenseId}`);
  return succeed();
}

export async function deleteReceiptAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const expenseId = String(formData.get("expenseId") ?? "");

  const expense = await prisma.expense.findFirst({
    where: {
      id: expenseId,
      OR: [
        { shares: { some: { userId: user.id } } },
        { group: { members: { some: { userId: user.id } } } },
      ],
    },
    select: { id: true },
  });
  if (!expense) return fail("You can't change this expense.");

  await prisma.receipt.deleteMany({ where: { expenseId } });
  revalidatePath(`/expenses/${expenseId}`);
  return succeed("Receipt removed.");
}
