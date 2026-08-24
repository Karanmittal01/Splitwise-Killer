import { cookies, headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { prisma } from "./db";

/**
 * Signing somebody in without going through an OAuth provider.
 *
 * Auth.js can't do this for us: its Credentials provider refuses to work with
 * the database session strategy, and this app very much wants database
 * sessions (they can be revoked, and the session row is where the user's
 * profile is read from on every request). So password sign-in mints the same
 * thing Auth.js would — a row in Session plus the cookie that points at it.
 *
 * Everything downstream is unchanged: `auth()` looks the token up in the same
 * table, and `signOut()` deletes the row and clears the cookie as usual.
 */

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function startSession(userId: string): Promise<void> {
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + MAX_AGE_SECONDS * 1000);

  await prisma.session.create({ data: { sessionToken, userId, expires } });

  const secure = await usesSecureCookies();
  const jar = await cookies();
  jar.set(secure ? "__Secure-authjs.session-token" : "authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    expires,
  });
}

/**
 * Which cookie name to write.
 *
 * Auth.js prefixes the name with `__Secure-` on an https origin, and reads back
 * only the name that matches the current request — so getting this wrong means
 * the cookie is set and then silently ignored. This mirrors the same decision
 * Auth.js makes in @auth/core (createActionURL → defaultCookies): the configured
 * URL wins if there is one, otherwise the forwarded protocol, defaulting to
 * https exactly as it does.
 */
async function usesSecureCookies(): Promise<boolean> {
  const configured = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (configured) {
    try {
      return new URL(configured).protocol === "https:";
    } catch {
      // A malformed AUTH_URL shouldn't break sign-in; fall back to the header.
    }
  }

  const forwarded = (await headers()).get("x-forwarded-proto") ?? "https";
  // Behind more than one proxy this can be a list, e.g. "https,http".
  return forwarded.split(",")[0].trim().replace(/:$/, "").toLowerCase() === "https";
}
