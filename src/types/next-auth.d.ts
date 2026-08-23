import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      defaultCurrency: string;
      phone: string | null;
      /** ISO string — session data has to survive serialisation. */
      activitySeenAt: string;
    } & DefaultSession["user"];
  }

  interface User {
    isPlaceholder?: boolean;
    defaultCurrency?: string;
  }
}
