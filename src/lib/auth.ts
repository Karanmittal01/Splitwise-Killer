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
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.defaultCurrency =
          (user as { defaultCurrency?: string }).defaultCurrency ?? "INR";
      }
      return session;
    },
  },
  events: {
    // A placeholder becomes a real account the moment its owner signs in.
    async signIn({ user, profile }) {
      if (!user.id) return;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isPlaceholder: false,
          name: user.name ?? profile?.name ?? undefined,
          image: user.image ?? (profile?.picture as string | undefined) ?? undefined,
          emailVerified: new Date(),
        },
      });
    },
  },
});
