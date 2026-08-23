"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { recordActivity } from "@/lib/activity";
import { formatMoney, parseMoneyToCents } from "@/lib/money";
import { isSupportedCurrency } from "@/lib/currencies";
import { displayName } from "@/lib/session";
import { fail, type ActionState } from "./types";

/**
 * Record a payment. It is stored as an expense with isPayment = true:
 * the sender "paid" the amount and the receiver "owes" it, so the balance
 * engine cancels the debt without any special-casing.
 */
export async function recordPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const fromUserId = String(formData.get("fromUserId") ?? "");
  const toUserId = String(formData.get("toUserId") ?? "");
  const groupId = String(formData.get("groupId") ?? "") || null;
  const currency = String(formData.get("currency") ?? user.defaultCurrency).toUpperCase();
  const note = String(formData.get("note") ?? "").trim();
  const dateRaw = String(formData.get("date") ?? "");

  if (!fromUserId || !toUserId) return fail("Choose who paid whom.");
  if (fromUserId === toUserId) return fail("A payment needs two different people.");
  if (!isSupportedCurrency(currency)) return fail("Pick a supported currency.");

  const amountCents = parseMoneyToCents(String(formData.get("amount") ?? ""), currency);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return fail("Enter an amount greater than zero.");
  }

  // You can record a payment you're part of, or any payment inside a group you belong to.
  const isParticipant = user.id === fromUserId || user.id === toUserId;
  if (!isParticipant) {
    if (!groupId) return fail("You can only record payments you are part of.");
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
    });
    if (!membership) return fail("You are not a member of that group.");
  }

  if (groupId) {
    const members = await prisma.groupMember.findMany({
      where: { groupId, userId: { in: [fromUserId, toUserId] } },
      select: { userId: true },
    });
    if (members.length !== 2) return fail("Both people need to be in that group.");
  }

  const [from, to] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: fromUserId }, select: { id: true, name: true, email: true, phone: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: toUserId }, select: { id: true, name: true, email: true, phone: true } }),
  ]);

  const date = dateRaw ? new Date(`${dateRaw}T12:00:00`) : new Date();
  const description = note || `${displayName(from)} paid ${displayName(to)}`;

  const payment = await prisma.expense.create({
    data: {
      groupId,
      description,
      amountCents,
      currency,
      date: Number.isNaN(date.getTime()) ? new Date() : date,
      category: "settlement",
      isPayment: true,
      splitMethod: "EXACT",
      createdById: user.id,
      shares: {
        create: [
          { userId: fromUserId, paidCents: amountCents, owedCents: 0 },
          { userId: toUserId, paidCents: 0, owedCents: amountCents },
        ],
      },
    },
    select: { id: true },
  });

  const audience = new Set([fromUserId, toUserId, user.id]);
  if (groupId) {
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    for (const m of members) audience.add(m.userId);
  }

  await recordActivity({
    type: "PAYMENT_RECORDED",
    actorId: user.id,
    groupId,
    expenseId: payment.id,
    summary: `recorded a payment: ${displayName(from)} → ${displayName(to)}`,
    detail: formatMoney(amountCents, currency),
    audience: [...audience],
  });

  revalidatePath("/dashboard");
  revalidatePath("/activity");
  if (groupId) revalidatePath(`/groups/${groupId}`);
  redirect(groupId ? `/groups/${groupId}` : `/friends/${user.id === fromUserId ? toUserId : fromUserId}`);
}
