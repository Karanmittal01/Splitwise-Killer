"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { recordActivity } from "@/lib/activity";
import { PeopleError, ensureFriendship, mergeUsers } from "@/lib/people";
import { emailConfigured, sendInviteEmail } from "@/lib/notify";
import { recordAttempt, tooManyAttempts } from "@/lib/ratelimit";
import { fail, succeed, type ActionState } from "./types";

/**
 * Redeem an invite link. The placeholder account the inviter has been putting
 * expenses against is folded into the signed-in account, so the balances that
 * were waiting for them simply appear.
 */
export async function claimInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const token = String(formData.get("token") ?? "");
  if (!token) return fail("This invite link is missing its code.");

  let groupId: string | null = null;

  try {
    const invite = await prisma.invitation.findUnique({
      where: { token },
      select: {
        id: true,
        targetUserId: true,
        invitedById: true,
        groupId: true,
        acceptedAt: true,
      },
    });
    if (!invite) return fail("That invite link is not valid.");
    groupId = invite.groupId;

    if (invite.targetUserId !== user.id) {
      await mergeUsers(invite.targetUserId, user.id);
    }

    await prisma.invitation.update({
      where: { id: invite.id },
      data: { acceptedAt: invite.acceptedAt ?? new Date() },
    });

    await ensureFriendship(user.id, invite.invitedById);

    if (invite.groupId) {
      await prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: invite.groupId, userId: user.id } },
        create: { groupId: invite.groupId, userId: user.id },
        update: {},
      });
      const group = await prisma.group.findUnique({
        where: { id: invite.groupId },
        select: { name: true, members: { select: { userId: true } } },
      });
      if (group) {
        await recordActivity({
          type: "GROUP_MEMBER_ADDED",
          actorId: user.id,
          groupId: invite.groupId,
          summary: `joined "${group.name}"`,
          audience: group.members.map((m) => m.userId),
        });
      }
    }
  } catch (error) {
    if (error instanceof PeopleError) return fail(error.message);
    return fail(error instanceof Error ? error.message : "Could not accept that invite.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/groups");
  redirect(groupId ? `/groups/${groupId}` : "/dashboard");
}

/** Join a group straight from its shareable link. */
export async function joinGroupByTokenAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const token = String(formData.get("token") ?? "");

  const group = await prisma.group.findUnique({
    where: { inviteToken: token },
    select: { id: true, name: true, members: { select: { userId: true } } },
  });
  if (!group) return fail("That group link is not valid any more.");

  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: group.id, userId: user.id } },
    create: { groupId: group.id, userId: user.id },
    update: {},
  });

  for (const member of group.members) {
    if (member.userId !== user.id) await ensureFriendship(user.id, member.userId);
  }

  await recordActivity({
    type: "GROUP_MEMBER_ADDED",
    actorId: user.id,
    groupId: group.id,
    summary: `joined "${group.name}"`,
    audience: [...group.members.map((m) => m.userId), user.id],
  });

  revalidatePath("/groups");
  redirect(`/groups/${group.id}`);
}

const RESEND_LIMIT = 3;
const RESEND_WINDOW_MS = 60 * 60 * 1000;

/**
 * Email (or re-email) a pending invite, from the server.
 *
 * The alternative — a mailto: link — opens your own mail app with a draft you
 * still have to write and send, which is a strange thing to ask when the app
 * already has a working mail server behind it. This just sends it. Useful when
 * somebody was added before email was configured, or the first one got lost.
 */
export async function resendInviteEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const targetUserId = String(formData.get("targetUserId") ?? "");
  if (!targetUserId) return fail("Missing person.");

  if (!emailConfigured) {
    return fail("Email delivery isn't set up on this server — copy the link instead.");
  }

  const invite = await prisma.invitation.findFirst({
    where: {
      targetUserId,
      acceptedAt: null,
      // You can only re-send invites you sent, or ones for a group you're in.
      OR: [{ invitedById: user.id }, { group: { members: { some: { userId: user.id } } } }],
    },
    orderBy: { createdAt: "desc" },
    select: { token: true, email: true, groupId: true },
  });
  if (!invite) return fail("There's no pending invite for that person.");

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { email: true, isPlaceholder: true },
  });
  if (target && !target.isPlaceholder) {
    return fail("They've already signed in — there's nothing left to invite them to.");
  }

  // Invited by number, then an email added later: the invite row has no address
  // but the account does, and that address is just as good to send to.
  const to = invite.email ?? target?.email ?? null;
  if (!to) {
    return fail(
      "They were invited by mobile number, so there's no address to email. Send the link over WhatsApp instead.",
    );
  }

  // One tap sends a real email to a real person. A few re-sends are reasonable
  // — a stuck finger is not.
  const key = `invite-email:${user.id}:${targetUserId}`;
  if (tooManyAttempts(key, RESEND_LIMIT)) {
    return fail("That invite has been emailed a few times already. Give it an hour, or send the link yourself.");
  }
  recordAttempt(key, RESEND_WINDOW_MS);

  const sent = await sendInviteEmail({
    to,
    token: invite.token,
    inviterId: user.id,
    groupId: invite.groupId,
  });

  return sent
    ? succeed(`Invite emailed to ${to}.`)
    : fail("The email couldn't be sent. Check the Resend settings, or copy the link instead.");
}
