"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { recordActivity } from "@/lib/activity";
import {
  PeopleError,
  createInvitation,
  ensureFriendship,
  findOrCreatePerson,
  normaliseEmail,
  normalisePhone,
} from "@/lib/people";
import { isSupportedCurrency } from "@/lib/currencies";
import { sendInviteEmail } from "@/lib/notify";
import { fail, succeed, type ActionState } from "./types";

const groupTypes = ["TRIP", "HOME", "COUPLE", "FRIENDS", "OTHER"] as const;

const groupSchema = z.object({
  name: z.string().trim().min(1, "Give your group a name.").max(80),
  type: z.enum(groupTypes),
  emoji: z.string().trim().min(1).max(8),
  currency: z.string().trim().length(3),
});

async function assertMember(groupId: string, userId: string) {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!membership) throw new Error("You are not a member of this group.");
  return membership;
}

export async function createGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = groupSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") ?? "OTHER",
    emoji: formData.get("emoji") || "🧾",
    currency: formData.get("currency") || user.defaultCurrency,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.");
  if (!isSupportedCurrency(parsed.data.currency)) return fail("Pick a supported currency.");

  const memberLines = String(formData.get("members") ?? "")
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean);

  let group;
  try {
    group = await prisma.group.create({
      data: {
        ...parsed.data,
        createdById: user.id,
        members: { create: { userId: user.id, isAdmin: true } },
      },
    });

    for (const line of memberLines) {
      await addPersonToGroup(group.id, line, user.id);
    }
  } catch (error) {
    if (error instanceof PeopleError) return fail(error.message);
    return fail(error instanceof Error ? error.message : "Could not create the group.");
  }

  await recordActivity({
    type: "GROUP_CREATED",
    actorId: user.id,
    groupId: group.id,
    summary: `created the group "${group.name}"`,
    audience: [user.id],
  });

  revalidatePath("/groups");
  redirect(`/groups/${group.id}`);
}

/** Accepts "Name <email>", a bare email, or a phone number. */
async function addPersonToGroup(groupId: string, raw: string, inviterId: string) {
  const angle = raw.match(/^(.*)<([^>]+)>$/);
  const name = angle?.[1]?.trim() || null;
  const handle = (angle?.[2] ?? raw).trim();

  const email = normaliseEmail(handle);
  const phone = email ? null : normalisePhone(handle);
  if (!email && !phone) {
    throw new PeopleError(`"${raw}" is not a valid email address or mobile number.`);
  }

  const { user: person } = await findOrCreatePerson({ name, email, phone }, inviterId);

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId, userId: person.id } },
    create: { groupId, userId: person.id },
    update: {},
  });
  await ensureFriendship(inviterId, person.id);

  let inviteToken: string | null = null;
  let emailed = false;
  if (person.isPlaceholder) {
    const invite = await createInvitation({
      targetUserId: person.id,
      invitedById: inviterId,
      email,
      phone,
      groupId,
    });
    inviteToken = invite.token;
    if (email) {
      emailed = await sendInviteEmail({ to: email, token: invite.token, inviterId, groupId });
    }
  }

  return { person, inviteToken, emailed };
}

export async function addGroupMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  const raw = String(formData.get("person") ?? "").trim();
  if (!groupId || !raw) return fail("Enter an email address or mobile number.");

  try {
    await assertMember(groupId, user.id);
    const group = await prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: { name: true, members: { select: { userId: true } } },
    });
    const { person, emailed } = await addPersonToGroup(groupId, raw, user.id);

    await recordActivity({
      type: "GROUP_MEMBER_ADDED",
      actorId: user.id,
      groupId,
      summary: `added ${person.name ?? person.email ?? person.phone} to "${group.name}"`,
      audience: [...group.members.map((m) => m.userId), person.id],
    });

    const who = person.name ?? person.email ?? person.phone;
    revalidatePath(`/groups/${groupId}`);
    return succeed(
      !person.isPlaceholder
        ? `Added ${who}.`
        : emailed
          ? `Invited ${who} — we've emailed them a link to sign in.`
          : `Invited ${who}. Copy their invite link below and send it to them.`,
    );
  } catch (error) {
    if (error instanceof PeopleError) return fail(error.message);
    return fail(error instanceof Error ? error.message : "Could not add that person.");
  }
}

export async function updateGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  if (!groupId) return fail("Missing group.");

  const parsed = groupSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    emoji: formData.get("emoji") || "🧾",
    currency: formData.get("currency"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form.");

  try {
    await assertMember(groupId, user.id);
    await prisma.group.update({
      where: { id: groupId },
      data: {
        ...parsed.data,
        simplifyDebts: formData.get("simplifyDebts") === "on",
        archived: formData.get("archived") === "on",
      },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not save the group.");
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
  return succeed("Group settings saved.");
}

export async function removeGroupMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  if (!groupId || !memberId) return fail("Missing details.");

  try {
    await assertMember(groupId, user.id);

    // Refuse to drop somebody who still has money tied up in the group.
    const shares = await prisma.expenseShare.findMany({
      where: { userId: memberId, expense: { groupId, deletedAt: null } },
      select: { paidCents: true, owedCents: true, expense: { select: { currency: true } } },
    });
    const netByCurrency = new Map<string, number>();
    for (const share of shares) {
      const currency = share.expense.currency;
      netByCurrency.set(
        currency,
        (netByCurrency.get(currency) ?? 0) + share.paidCents - share.owedCents,
      );
    }
    if ([...netByCurrency.values()].some((v) => v !== 0)) {
      return fail("That person still has a balance in this group. Settle up first.");
    }

    const group = await prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: { name: true, members: { select: { userId: true } } },
    });
    const person = await prisma.user.findUnique({
      where: { id: memberId },
      select: { name: true, email: true },
    });

    await prisma.groupMember.delete({
      where: { groupId_userId: { groupId, userId: memberId } },
    });

    await recordActivity({
      type: "GROUP_MEMBER_LEFT",
      actorId: user.id,
      groupId,
      summary:
        memberId === user.id
          ? `left "${group.name}"`
          : `removed ${person?.name ?? person?.email ?? "someone"} from "${group.name}"`,
      audience: group.members.map((m) => m.userId),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not remove that member.");
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/groups");
  if (memberId === user.id) redirect("/groups");
  return succeed("Member removed.");
}

export async function deleteGroupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    return fail('Type DELETE to confirm.');
  }

  try {
    const membership = await assertMember(groupId, user.id);
    const group = await prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: { createdById: true },
    });
    // Deleting wipes the group for everybody, so it stays with its owners.
    if (!membership.isAdmin && group.createdById !== user.id) {
      return fail("Only a group admin can delete the group. You can leave it instead.");
    }
    await prisma.group.delete({ where: { id: groupId } });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not delete the group.");
  }

  revalidatePath("/groups");
  redirect("/groups");
}

export async function resetInviteLinkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  try {
    await assertMember(groupId, user.id);
    await prisma.group.update({
      where: { id: groupId },
      data: { inviteToken: crypto.randomUUID() },
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not reset the link.");
  }
  revalidatePath(`/groups/${groupId}/settings`);
  return succeed("A fresh invite link has been generated. The old one no longer works.");
}
