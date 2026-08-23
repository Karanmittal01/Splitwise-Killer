import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { normaliseEmail } from "@/lib/people";

/**
 * Local-only sign-in so the app can be run and tested before Google OAuth
 * credentials exist.
 *
 * Hard-gated on NODE_ENV !== "production" *and* ALLOW_DEV_LOGIN=true, so it can
 * never become a back door on a deployed site.
 */
function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_LOGIN === "true";
}

export async function POST(request: Request) {
  if (!devLoginEnabled()) {
    return NextResponse.json({ error: "Not available." }, { status: 404 });
  }

  const form = await request.formData();
  const email = normaliseEmail(String(form.get("email") ?? ""));
  const name = String(form.get("name") ?? "").trim() || email?.split("@")[0] || "Tester";
  if (!email) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { isPlaceholder: false, name: existing.name ?? name, emailVerified: new Date() },
      })
    : await prisma.user.create({
        data: { email, name, isPlaceholder: false, emailVerified: new Date() },
      });

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } });

  const jar = await cookies();
  jar.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });

  return NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
}
