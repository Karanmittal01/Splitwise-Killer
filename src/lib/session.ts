import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  phone: string | null;
  defaultCurrency: string;
  activitySeenAt: Date;
};

/**
 * The signed-in user, or null. Cached per request.
 *
 * Everything here comes off the session, which the auth callback already
 * populated from the User row it had to read anyway — so this costs no extra
 * database round trip.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    phone: session.user.phone ?? null,
    defaultCurrency: session.user.defaultCurrency || "INR",
    activitySeenAt: new Date(session.user.activitySeenAt),
  };
});

/** Same, but bounces to the login page when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Re-exported so server code can keep importing them from one place.
export { displayName, initials } from "./names";
