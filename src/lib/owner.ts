import type { CurrentUser } from "./session";

/**
 * Who is allowed to see the Tools section.
 *
 * Splitwise Killer has open sign-up, so a personal utility that spends money
 * has to be gated to the person who owns the deployment. `OWNER_EMAIL` already
 * exists for contact-form delivery and doubles as the allowlist. Unset, Tools is
 * invisible to everybody — the right default for anyone else running this code.
 */
export function isOwner(user: Pick<CurrentUser, "email"> | null): boolean {
  const ownerEmail = (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
  if (!ownerEmail) return false;

  const email = user?.email?.trim().toLowerCase();
  return Boolean(email) && email === ownerEmail;
}
