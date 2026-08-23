import path from "node:path";
import { defineConfig, env } from "prisma/config";

// The Prisma CLI does not read .env files on its own (Next.js does at runtime),
// so load it here with Node's built-in loader when it exists.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // No .env file — rely on real environment variables (CI / hosting provider).
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
