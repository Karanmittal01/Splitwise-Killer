import { prisma } from "./db";
import { normaliseEmail, normalisePhone, phoneVariants } from "./contact";

/**
 * People can exist in this app before they ever sign in.
 *
 * Adding somebody by email or phone creates a *placeholder* user that carries
 * real balances. When that person signs in with Google using the same email,
 * Auth.js links the account to the placeholder (see auth.ts) and they simply
 * see everything waiting for them. When they were invited by phone, or with a
 * different email than their Google one, they redeem the invite link and we
 * merge the placeholder into their real account.
 */

// Re-exported so callers can keep importing contact helpers from here.
export { normaliseEmail, normalisePhone, phoneVariants } from "./contact";

export type PersonInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export class PeopleError extends Error {}

/**
 * Find the user behind an email/phone, creating a placeholder if this is the
 * first time anybody has mentioned them.
 */
export async function findOrCreatePerson(
  input: PersonInput,
  createdById: string,
): Promise<{ user: { id: string; name: string | null; email: string | null; phone: string | null; isPlaceholder: boolean }; created: boolean }> {
  const email = normaliseEmail(input.email);
  const phone = normalisePhone(input.phone);
  const name = input.name?.trim() || null;

  if (!email && !phone) {
    throw new PeopleError("Enter an email address or a mobile number.");
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        // Match numbers stored before canonicalisation too, so an existing
        // person is found rather than duplicated.
        ...(phone ? [{ phone: { in: phoneVariants(phone) } }] : []),
      ],
    },
    select: { id: true, name: true, email: true, phone: true, isPlaceholder: true },
  });

  if (existing) {
    // Backfill anything we learned about them this time round.
    const patch: Record<string, string> = {};
    if (email && !existing.email) patch.email = email;
    if (phone && !existing.phone) patch.phone = phone;
    if (name && !existing.name) patch.name = name;
    if (Object.keys(patch).length > 0) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: patch,
        select: { id: true, name: true, email: true, phone: true, isPlaceholder: true },
      });
      return { user: updated, created: false };
    }
    return { user: existing, created: false };
  }

  const user = await prisma.user.create({
    data: {
      name: name ?? email?.split("@")[0] ?? phone,
      email,
      phone,
      isPlaceholder: true,
      createdById,
    },
    select: { id: true, name: true, email: true, phone: true, isPlaceholder: true },
  });
  return { user, created: true };
}

/** Friendships are mirrored so "who are my friends" is one indexed lookup. */
export async function ensureFriendship(userId: string, friendId: string): Promise<void> {
  if (userId === friendId) return;
  await prisma.$transaction([
    prisma.friendship.upsert({
      where: { userId_friendId: { userId, friendId } },
      create: { userId, friendId },
      update: {},
    }),
    prisma.friendship.upsert({
      where: { userId_friendId: { userId: friendId, friendId: userId } },
      create: { userId: friendId, friendId: userId },
      update: {},
    }),
  ]);
}

export async function createInvitation(params: {
  targetUserId: string;
  invitedById: string;
  email?: string | null;
  phone?: string | null;
  groupId?: string | null;
}): Promise<{ id: string; token: string }> {
  const invite = await prisma.invitation.create({
    data: {
      targetUserId: params.targetUserId,
      invitedById: params.invitedById,
      email: normaliseEmail(params.email),
      phone: normalisePhone(params.phone),
      groupId: params.groupId ?? null,
    },
    select: { id: true, token: true },
  });
  return invite;
}

export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.AUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}

export function inviteLink(token: string): string {
  return `${appUrl()}/join/${token}`;
}

/**
 * Fold `sourceId` into `targetId`. Used when somebody redeems an invite for a
 * placeholder that isn't matched by their email. Everything the placeholder
 * touched — shares, memberships, comments, activity — moves across, and
 * duplicates (both accounts on the same expense or in the same group) are
 * merged rather than dropped.
 */
export async function mergeUsers(sourceId: string, targetId: string): Promise<void> {
  if (sourceId === targetId) return;

  await prisma.$transaction(async (tx) => {
    const source = await tx.user.findUnique({
      where: { id: sourceId },
      select: { id: true, isPlaceholder: true, name: true, email: true, phone: true },
    });
    if (!source) return;
    if (!source.isPlaceholder) {
      throw new PeopleError("That invite belongs to an account that has already been claimed.");
    }

    // Expense shares — sum where both accounts appear on the same expense.
    const shares = await tx.expenseShare.findMany({ where: { userId: sourceId } });
    for (const share of shares) {
      const clash = await tx.expenseShare.findUnique({
        where: { expenseId_userId: { expenseId: share.expenseId, userId: targetId } },
      });
      if (clash) {
        await tx.expenseShare.update({
          where: { id: clash.id },
          data: {
            paidCents: clash.paidCents + share.paidCents,
            owedCents: clash.owedCents + share.owedCents,
          },
        });
        await tx.expenseShare.delete({ where: { id: share.id } });
      } else {
        await tx.expenseShare.update({ where: { id: share.id }, data: { userId: targetId } });
      }
    }

    // Group memberships — keep one row, preserving admin rights.
    const memberships = await tx.groupMember.findMany({ where: { userId: sourceId } });
    for (const membership of memberships) {
      const clash = await tx.groupMember.findUnique({
        where: { groupId_userId: { groupId: membership.groupId, userId: targetId } },
      });
      if (clash) {
        if (membership.isAdmin && !clash.isAdmin) {
          await tx.groupMember.update({ where: { id: clash.id }, data: { isAdmin: true } });
        }
        await tx.groupMember.delete({ where: { id: membership.id } });
      } else {
        await tx.groupMember.update({ where: { id: membership.id }, data: { userId: targetId } });
      }
    }

    // Friendships — re-point both directions, drop self-links and duplicates.
    const friendships = await tx.friendship.findMany({
      where: { OR: [{ userId: sourceId }, { friendId: sourceId }] },
    });
    for (const friendship of friendships) {
      const userId = friendship.userId === sourceId ? targetId : friendship.userId;
      const friendId = friendship.friendId === sourceId ? targetId : friendship.friendId;
      await tx.friendship.delete({ where: { id: friendship.id } });
      if (userId === friendId) continue;
      await tx.friendship.upsert({
        where: { userId_friendId: { userId, friendId } },
        create: { userId, friendId },
        update: {},
      });
    }

    await tx.expense.updateMany({ where: { createdById: sourceId }, data: { createdById: targetId } });
    await tx.comment.updateMany({ where: { userId: sourceId }, data: { userId: targetId } });
    await tx.activity.updateMany({ where: { actorId: sourceId }, data: { actorId: targetId } });
    await tx.group.updateMany({ where: { createdById: sourceId }, data: { createdById: targetId } });
    await tx.invitation.updateMany({
      where: { invitedById: sourceId },
      data: { invitedById: targetId },
    });
    await tx.invitation.updateMany({
      where: { targetUserId: sourceId },
      data: { targetUserId: targetId },
    });
    // Private notes tagged to the merged-away person now point at the survivor.
    await tx.personalNote.updateMany({
      where: { aboutUserId: sourceId },
      data: { aboutUserId: targetId },
    });

    // Activity fan-out rows: move across, ignoring rows the target already has.
    const audience = await tx.activityAudience.findMany({ where: { userId: sourceId } });
    for (const row of audience) {
      const clash = await tx.activityAudience.findUnique({
        where: { activityId_userId: { activityId: row.activityId, userId: targetId } },
      });
      if (clash) await tx.activityAudience.delete({ where: { id: row.id } });
      else await tx.activityAudience.update({ where: { id: row.id }, data: { userId: targetId } });
    }

    // Carry over any contact details the survivor is missing.
    const target = await tx.user.findUnique({
      where: { id: targetId },
      select: { phone: true, name: true, email: true },
    });
    const patch: Record<string, string> = {};
    if (source.phone && !target?.phone) patch.phone = source.phone;
    if (source.email && !target?.email) patch.email = source.email;
    if (source.name && !target?.name) patch.name = source.name;

    // Free up the unique email/phone before the target claims them.
    await tx.user.update({
      where: { id: sourceId },
      data: { email: null, phone: null },
    });
    if (Object.keys(patch).length > 0) {
      await tx.user.update({ where: { id: targetId }, data: patch });
    }
    await tx.user.delete({ where: { id: sourceId } });
  });
}
