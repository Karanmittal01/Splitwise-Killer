import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      defaultCurrency: string;
    } & DefaultSession["user"];
  }

  interface User {
    isPlaceholder?: boolean;
    defaultCurrency?: string;
  }
}
