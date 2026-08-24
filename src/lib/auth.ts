import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";

const googleId = process.env.AUTH_GOOGLE_ID;
const googleSecret = process.env.AUTH_GOOGLE_SECRET;

export const googleConfigured = Boolean(googleId && googleSecret);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database", maxAge: 60 * 60 * 24 * 30 },
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  providers: googleConfigured
    ? [
        Google({
          clientId: googleId,
          clientSecret: googleSecret,
          /**
           * When somebody is invited by email we create a placeholder account
           * that already holds their share of the expenses. Linking on a
           * matching email is what lets them walk into those balances on first
           * sign-in. Google only ever hands us verified addresses, so this is
           * the intended use of the flag rather than a security hole.
           */
          allowDangerousEmailAccountLinking: true,
          profile(profile) {
            return {
              id: profile.sub,
              name: profile.name,
              email: profile.email,
              image: profile.picture,
              isPlaceholder: false,
            };
          },
        }),
      ]
    : [],
  callbacks: {
    /**
     * The adapter has already loaded the whole User row to build this session,
     * so everything the app needs about the signed-in person is copied onto it
     * here. That saves a second query for the same row on every request —
     * which matters a lot when the database is a long way from the server.
     */
    session({ session, user }) {
      if (session.user) {
        const row = user as typeof user & {
          phone?: string | null;
          defaultCurrency?: string | null;
          activitySeenAt?: Date | string | null;
        };
        session.user.id = user.id;
        session.user.phone = row.phone ?? null;
        session.user.defaultCurrency = row.defaultCurrency ?? "INR";
        session.user.activitySeenAt = row.activitySeenAt
          ? new Date(row.activitySeenAt).toISOString()
          : new Date(0).toISOString();
      }
      return session;
    },
  },
  events: {
    // A placeholder becomes a real account the moment its owner signs in.
    async signIn({ user, profile }) {
      if (!user.id) return;

      const existing = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isPlaceholder: true, name: true, image: true },
      });

      // Claiming a placeholder: whatever the inviter typed as a name, and the
      // absence of a picture, are both replaced by the real Google profile.
      // Afterwards their own choices win — a picture they uploaded here is
      // never overwritten by Google on a later sign-in.
      const claiming = existing?.isPlaceholder ?? true;
      const googleName = (profile?.name as string | undefined) ?? user.name ?? undefined;
      const googlePicture = (profile?.picture as string | undefined) ?? user.image ?? undefined;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          isPlaceholder: false,
          emailVerified: new Date(),
          name: claiming ? googleName : (existing?.name ?? googleName),
          image: claiming ? googlePicture : (existing?.image ?? googlePicture),
          // A placeholder may be carrying a password from a sign-up that was
          // never confirmed by email — possibly somebody else's hopeful guess
          // at this address. Walking in through Google settles who owns the
          // account, so that unconfirmed password is thrown away. A password
          // the owner set themselves is on a non-placeholder account and is
          // left well alone.
          ...(claiming ? { passwordHash: null } : {}),
        },
      });
    },
  },
});
