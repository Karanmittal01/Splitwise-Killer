import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { prisma } from "./db";

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  phone: string | null;
  defaultCurrency: string;
  activitySeenAt: Date;
};

/** The signed-in user, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      phone: true,
      defaultCurrency: true,
      activitySeenAt: true,
    },
  });
  return user;
});

/** Same, but bounces to the login page when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Re-exported so server code can keep importing them from one place.
export { displayName, initials } from "./names";
