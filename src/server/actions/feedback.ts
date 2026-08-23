"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { normaliseEmail } from "@/lib/people";
import { sendFeedbackEmail } from "@/lib/notify";
import { fail, succeed, type ActionState } from "./types";

/**
 * Store a message from the contact page.
 *
 * It always lands in the database so nothing is lost if email isn't set up;
 * when Resend is configured a copy is emailed to the owner as well.
 */
export async function sendFeedbackAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();

  const name = String(formData.get("name") ?? "").trim();
  const email = normaliseEmail(String(formData.get("email") ?? ""));
  const message = String(formData.get("message") ?? "").trim();

  if (name === "") return fail("Tell us who you are.");
  if (message.length < 5) return fail("Say a little more than that.");
  if (message.length > 4000) return fail("That message is too long.");

  await prisma.feedback.create({
    data: { userId: user?.id ?? null, name, email: email ?? user?.email ?? null, message },
  });

  await sendFeedbackEmail({ name, email: email ?? user?.email ?? null, message });

  return succeed("Thanks — your message has been sent.");
}
