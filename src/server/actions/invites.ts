"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { recordActivity } from "@/lib/activity";
import { PeopleError, ensureFriendship, mergeUsers } from "@/lib/people";
import { fail, type ActionState } from "./types";

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
