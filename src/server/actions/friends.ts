"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { recordActivity } from "@/lib/activity";
import {
  PeopleError,
  createInvitation,
  ensureFriendship,
  findOrCreatePerson,
  mergeUsers,
  normaliseEmail,
  normalisePhone,
  phoneVariants,
} from "@/lib/people";
import { sendInviteEmail } from "@/lib/notify";
import { fail, succeed, type ActionState } from "./types";

export async function addFriendAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim() || null;
  const handle = String(formData.get("handle") ?? "").trim();

  const email = normaliseEmail(handle);
  const phone = email ? null : normalisePhone(handle);
  if (!email && !phone) return fail("Enter a valid email address or mobile number.");

  try {
    const { user: person } = await findOrCreatePerson({ name, email, phone }, user.id);
    if (person.id === user.id) return fail("That's you!");

    await ensureFriendship(user.id, person.id);

    let invited = false;
    let emailed = false;
    if (person.isPlaceholder) {
      const invite = await createInvitation({
        targetUserId: person.id,
        invitedById: user.id,
        email,
        phone,
      });
      invited = true;
      if (email) {
        emailed = await sendInviteEmail({ to: email, token: invite.token, inviterId: user.id });
      }
    }

    await recordActivity({
      type: "FRIEND_ADDED",
      actorId: user.id,
      summary: `added ${person.name ?? person.email ?? person.phone} as a friend`,
      audience: [user.id, person.id],
    });

    revalidatePath("/friends");
    return succeed(
      !invited
        ? `${person.name ?? handle} is now on your friends list.`
        : emailed
          ? `${person.name ?? handle} was added — we've emailed them a link to sign in.`
          : `${person.name ?? handle} was added. Open their page to copy an invite link to send them.`,
    );
  } catch (error) {
    if (error instanceof PeopleError) return fail(error.message);
    return fail(error instanceof Error ? error.message : "Could not add that person.");
  }
}

export async function removeFriendAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const friendId = String(formData.get("friendId") ?? "");
  if (!friendId) return fail("Missing friend.");

  const shared = await prisma.expense.findFirst({
    where: {
      deletedAt: null,
      AND: [{ shares: { some: { userId: user.id } } }, { shares: { some: { userId: friendId } } }],
    },
    select: { id: true },
  });
  if (shared) {
    return fail("You still share expenses with this person. Settle up and delete them first.");
  }

  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { userId: user.id, friendId },
        { userId: friendId, friendId: user.id },
      ],
    },
  });

  revalidatePath("/friends");
  return succeed("Removed from your friends list.");
}

export type QuickPerson = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  isPlaceholder: boolean;
};

/**
 * Used by the "add an expense" screen so you can type somebody's email
 * straight into the split without leaving the form.
 */
export async function quickAddPersonAction(input: {
  name?: string;
  handle: string;
}): Promise<{ ok: true; person: QuickPerson } | { ok: false; error: string }> {
  const user = await requireUser();
  const handle = input.handle.trim();
  const email = normaliseEmail(handle);
  const phone = email ? null : normalisePhone(handle);
  if (!email && !phone) return { ok: false, error: "Enter a valid email address or mobile number." };

  try {
    const { user: person } = await findOrCreatePerson(
      { name: input.name?.trim() || null, email, phone },
      user.id,
    );
    if (person.id === user.id) return { ok: false, error: "That's you — you're already included." };

    await ensureFriendship(user.id, person.id);
    if (person.isPlaceholder) {
      const invite = await createInvitation({
        targetUserId: person.id,
        invitedById: user.id,
        email,
        phone,
      });
      if (email) await sendInviteEmail({ to: email, token: invite.token, inviterId: user.id });
    }

    revalidatePath("/friends");
    return {
      ok: true,
      person: {
        id: person.id,
        name: person.name,
        email: person.email,
        phone: person.phone,
        image: null,
        isPlaceholder: person.isPlaceholder,
      },
    };
  } catch (error) {
    if (error instanceof PeopleError) return { ok: false, error: error.message };
    return { ok: false, error: "Could not add that person." };
  }
}

/** Set or clear a private nickname for a friend. */
export async function setNicknameAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const friendId = String(formData.get("friendId") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim();

  if (!friendId) return fail("Missing person.");
  if (nickname.length > 60) return fail("Nicknames are limited to 60 characters.");

  const friendship = await prisma.friendship.findUnique({
    where: { userId_friendId: { userId: user.id, friendId } },
    select: { id: true },
  });
  if (!friendship) return fail("They're not on your friends list.");

  await prisma.friendship.update({
    where: { id: friendship.id },
    data: { nickname: nickname === "" ? null : nickname },
  });

  revalidatePath("/friends");
  revalidatePath(`/friends/${friendId}`);
  revalidatePath("/dashboard");
  return succeed(nickname === "" ? "Nickname cleared." : "Nickname saved.");
}

export type ImportCandidate = { name: string; handle: string };

/**
 * Add several people at once from the phone's contact list.
 *
 * Everything goes through the same findOrCreatePerson path as adding one by
 * hand, so numbers are canonicalised and anybody already known is matched
 * rather than duplicated.
 */
export async function importContactsAction(
  contacts: ImportCandidate[],
): Promise<{ added: number; existing: number; failed: string[] }> {
  const user = await requireUser();
  const result = { added: 0, existing: 0, failed: [] as string[] };

  for (const contact of contacts.slice(0, 100)) {
    const handle = contact.handle.trim();
    const email = normaliseEmail(handle);
    const phone = email ? null : normalisePhone(handle);
    if (!email && !phone) {
      result.failed.push(contact.name || handle);
      continue;
    }

    try {
      const { user: person } = await findOrCreatePerson(
        { name: contact.name?.trim() || null, email, phone },
        user.id,
      );
      if (person.id === user.id) continue;

      const already = await prisma.friendship.findUnique({
        where: { userId_friendId: { userId: user.id, friendId: person.id } },
        select: { id: true },
      });
      await ensureFriendship(user.id, person.id);
      if (already) {
        result.existing += 1;
        continue;
      }
      result.added += 1;

      if (person.isPlaceholder) {
        const invite = await createInvitation({
          targetUserId: person.id,
          invitedById: user.id,
          email,
          phone,
        });
        if (email) await sendInviteEmail({ to: email, token: invite.token, inviterId: user.id });
      }
    } catch {
      result.failed.push(contact.name || handle);
    }
  }

  revalidatePath("/friends");
  return result;
}

/**
 * Add an email or mobile number to an existing (placeholder) friend.
 *
 * If that detail already belongs to another person you know, the two are the
 * same human entered twice — so the profiles are merged into one, keeping a
 * real (signed-in) account over a placeholder, and folding every shared
 * expense, group and note together. Otherwise the detail is simply saved.
 */
export async function addFriendContactAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const friendId = String(formData.get("friendId") ?? "");
  const handle = String(formData.get("handle") ?? "").trim();

  const email = normaliseEmail(handle);
  const phone = email ? null : normalisePhone(handle);
  if (!email && !phone) return fail("Enter a valid email address or mobile number.");

  const friendship = await prisma.friendship.findUnique({
    where: { userId_friendId: { userId: user.id, friendId } },
    select: { id: true },
  });
  if (!friendship) return fail("They're not on your friends list.");

  const friend = await prisma.user.findUnique({
    where: { id: friendId },
    select: { id: true, email: true, phone: true, isPlaceholder: true },
  });
  if (!friend) return fail("That person no longer exists.");

  // Already recorded on this friend — nothing to do.
  if (email && friend.email === email) return succeed("That email is already saved.");
  if (phone && friend.phone && phoneVariants(handle).includes(friend.phone)) {
    return succeed("That number is already saved.");
  }

  // Does anybody else already hold this detail?
  const other = await prisma.user.findFirst({
    where: {
      id: { not: friendId },
      OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone: { in: phoneVariants(handle) } }] : [])],
    },
    select: { id: true, isPlaceholder: true },
  });

  if (other) {
    if (other.id === user.id) {
      return fail("That's your own contact — you can't merge a friend into yourself.");
    }
    if (!other.isPlaceholder && !friend.isPlaceholder) {
      return fail("Both are full accounts, so they can't be merged.");
    }
    // A real account can only be merged into if it's already your friend —
    // you can't attach expenses to a stranger's account by guessing an email.
    if (!other.isPlaceholder) {
      const knowOther = await prisma.friendship.findUnique({
        where: { userId_friendId: { userId: user.id, friendId: other.id } },
        select: { id: true },
      });
      if (!knowOther) {
        return fail("That email or number belongs to someone who isn't your friend yet.");
      }
    }

    // Keep the real account when there is one; otherwise keep the friend being
    // edited. mergeUsers requires the source to be a placeholder, which every
    // branch below satisfies.
    const [sourceId, targetId] =
      friend.isPlaceholder && !other.isPlaceholder
        ? [friend.id, other.id]
        : [other.id, friend.id];

    try {
      await mergeUsers(sourceId, targetId);
    } catch (error) {
      if (error instanceof PeopleError) return fail(error.message);
      return fail("Could not merge those profiles.");
    }

    await ensureFriendship(user.id, targetId);
    revalidatePath("/friends");
    revalidatePath("/dashboard");
    // Land on whichever profile survived.
    redirect(`/friends/${targetId}`);
  }

  // No duplicate: just record the detail. Only a placeholder can take one —
  // a signed-in account owns its own email and phone.
  if (!friend.isPlaceholder) {
    return fail("This friend has their own account and manages their own contact details.");
  }

  await prisma.user.update({
    where: { id: friend.id },
    data: email ? { email } : { phone },
  });

  revalidatePath(`/friends/${friendId}`);
  revalidatePath("/friends");
  return succeed(email ? "Email saved." : "Mobile number saved.");
}
