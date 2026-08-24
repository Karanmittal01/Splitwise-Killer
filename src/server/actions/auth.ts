"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { normaliseEmail } from "@/lib/people";
import { startSession } from "@/lib/auth-session";
import { requireUser } from "@/lib/session";
import { emailConfigured, sendVerificationEmail } from "@/lib/notify";
import { clearAttempts, recordAttempt, tooManyAttempts } from "@/lib/ratelimit";
import { equivalentWork, hashPassword, verifyPassword } from "@/lib/password";
import { passwordProblem } from "@/lib/password-rules";
import { fail, succeed, type ActionState } from "./types";

/**
 * Email-and-password sign up, sign in, and setting a password on an account
 * that arrived through Google.
 *
 * The one subtlety worth knowing before reading on: an email address that has
 * already been invited here owns real balances, even though nobody has ever
 * signed into it. Handing those over to whoever types the address first would
 * be a way to read a stranger's expenses, so that specific case — and only that
 * case — is held behind a confirmation email.
 */

const VERIFY_PREFIX = "verify-email:";
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Deliberately says nothing about whether the account exists. The nudge about
 * Google is fixed text, shown to everybody, so it gives nothing away either.
 */
const WRONG_CREDENTIALS =
  "That email and password don't match. If you joined with Google, use Continue with Google — you can add a password afterwards from Account.";

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = normaliseEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (name.length === 0) return fail("Tell us your name so friends recognise you.");
  if (!email) return fail("Enter a valid email address.");

  const problem = passwordProblem(password, email);
  if (problem) return fail(problem);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isPlaceholder: true },
  });

  // A real account already lives here. Never confirm or deny a password.
  if (existing && !existing.isPlaceholder) {
    return fail(
      "That email already has an account. Sign in instead — or use Continue with Google if that's how you joined.",
    );
  }

  const passwordHash = await hashPassword(password);

  if (existing) {
    // A placeholder: someone has been splitting bills against this address and
    // the balances are sitting there waiting. Prove the address is yours first.
    if (!emailConfigured) {
      return fail(
        "A friend has already added this email, so we need to check it's really yours. Open the invite link they sent you, or use Continue with Google.",
      );
    }

    // The password is stored now but the account stays a placeholder, and
    // placeholders can't be signed into (see signInAction) — so it is inert
    // until the link in the email is opened. Claiming the account with Google
    // clears it, so a hopeful stranger's password can't outlive the real owner
    // walking in the front door.
    await prisma.user.update({ where: { id: existing.id }, data: { name, passwordHash } });
    await sendVerificationEmail({ to: email, token: await issueVerificationToken(email) });

    return succeed(
      `Almost there — check ${email}. We've sent a link to confirm the address is yours, because there are already expenses waiting on it.`,
    );
  }

  // Nobody has ever mentioned this address, so there is nothing to hand over
  // and nothing to prove. Straight in.
  const user = await prisma.user.create({
    data: { name, email, passwordHash, isPlaceholder: false },
  });

  await startSession(user.id);
  redirect(next);
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = normaliseEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) return fail("Enter your email and your password.");

  const key = `signin:${email}`;
  if (tooManyAttempts(key)) {
    return fail("Too many attempts on this email. Wait a few minutes and try again.");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, isPlaceholder: true },
  });

  // No account, no password on it, or still an unclaimed placeholder — all
  // answered identically, and at the same speed.
  if (!user || !user.passwordHash || user.isPlaceholder) {
    await equivalentWork(password);
    recordAttempt(key);
    return fail(WRONG_CREDENTIALS);
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    recordAttempt(key);
    return fail(WRONG_CREDENTIALS);
  }

  clearAttempts(key);
  await startSession(user.id);
  redirect(next);
}

/**
 * Set a password from the account page, or change one that's already set.
 *
 * Somebody who signed up with Google has no current password to give, and
 * they're already signed in, so the first time through only asks for the new
 * one. After that, changing it needs the old one — otherwise a borrowed open
 * laptop is enough to lock its owner out.
 */
export async function setPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmPassword") ?? "");

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, email: true },
  });

  const changing = Boolean(row?.passwordHash);
  if (changing) {
    if (!current) return fail("Enter your current password.");
    if (!(await verifyPassword(current, row?.passwordHash ?? null))) {
      return fail("That current password isn't right.");
    }
  }

  const problem = passwordProblem(password, row?.email ?? user.email);
  if (problem) return fail(problem);
  if (password !== confirmation) return fail("The two passwords don't match.");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });

  revalidatePath("/account");
  return succeed(
    changing
      ? "Password changed."
      : "Password set. You can now sign in with your email as well as with Google.",
  );
}

/**
 * Open the link from the confirmation email: the placeholder becomes a real
 * account, holding every expense that was already filed against the address.
 *
 * The token is consumed here rather than on the page that shows the link, so
 * that an email scanner following the URL can't burn it before its owner does.
 */
export async function confirmEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return fail("That confirmation link is missing its code.");

  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || !record.identifier.startsWith(VERIFY_PREFIX)) {
    return fail("That confirmation link is not valid. Try signing up again.");
  }

  if (record.expires < new Date()) {
    await prisma.verificationToken.deleteMany({ where: { token } });
    return fail("That confirmation link has expired. Sign up again to get a fresh one.");
  }

  const email = record.identifier.slice(VERIFY_PREFIX.length);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (!user?.passwordHash) {
    await prisma.verificationToken.deleteMany({ where: { token } });
    return fail("There's no sign-up waiting on this address any more. Please sign up again.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { isPlaceholder: false, emailVerified: new Date() },
    }),
    prisma.verificationToken.deleteMany({ where: { identifier: record.identifier } }),
  ]);

  await startSession(user.id);
  redirect("/dashboard");
}

/** One live confirmation link per address; asking again replaces the old one. */
async function issueVerificationToken(email: string): Promise<string> {
  const identifier = `${VERIFY_PREFIX}${email}`;
  const token = randomBytes(32).toString("base64url");

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: { identifier, token, expires: new Date(Date.now() + VERIFY_TTL_MS) },
  });

  return token;
}

/**
 * Where to land after signing in. Anything that isn't a plain path on this site
 * is ignored, so a crafted `?next=` can't bounce somebody to another domain
 * wearing our sign-in page.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value ?? "");
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}
