"use server";

import { revalidatePath } from "next/cache";
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
