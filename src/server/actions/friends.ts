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
    if (person.isPlaceholder) {
      const invite = await createInvitation({
        targetUserId: person.id,
        invitedById: user.id,
        email,
        phone,
      });
      invited = true;
      if (email) await sendInviteEmail({ to: email, token: invite.token, inviterId: user.id });
    }

    await recordActivity({
      type: "FRIEND_ADDED",
      actorId: user.id,
      summary: `added ${person.name ?? person.email ?? person.phone} as a friend`,
      audience: [user.id, person.id],
    });

    revalidatePath("/friends");
    return succeed(
      invited
        ? `${person.name ?? handle} was added. Share their invite link from their page so they can sign in.`
        : `${person.name ?? handle} is now on your friends list.`,
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
