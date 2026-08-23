import Link from "next/link";
import { redirect } from "next/navigation";
import { googleConfigured, signIn } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { SubmitButton } from "@/components/form";
import { BrandMark } from "@/components/BrandMark";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "An account with that email already exists. Sign in with the method you used the first time.",
  AccessDenied: "Google did not let us complete that sign-in.",
  Configuration: "Google sign-in is not configured on this server yet.",
  Verification: "That sign-in link has expired. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string; next?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const next = params.next ?? params.callbackUrl ?? "/dashboard";

  if (user) redirect(next);

  const devLogin = process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_LOGIN === "true";
  const error = params.error ? (ERRORS[params.error] ?? "Something went wrong signing you in.") : null;

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <BrandMark size={40} />
          <span className="text-xl font-bold tracking-tight">Splitwise Killer</span>
        </Link>

        <div className="card animate-rise p-7">
          <h1 className="text-xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm muted">
            Sign in to see what you owe, what you&apos;re owed, and everything in between.
          </p>

          {error && (
            <p className="mt-4 rounded-xl bg-[var(--color-coral-50)] px-3 py-2 text-sm text-[var(--color-coral-700)] dark:bg-[#3a1d15] dark:text-[var(--color-coral-300)]">
              {error}
            </p>
          )}

          {googleConfigured ? (
            <form
              className="mt-6"
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: next });
              }}
            >
              <SubmitButton className="btn btn-primary w-full py-3" pendingLabel="Opening Google…">
                <GoogleMark />
                Continue with Google
              </SubmitButton>
            </form>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-[var(--surface-border)] p-4 text-sm muted">
              <p className="font-semibold text-[var(--text-strong)]">Google sign-in isn&apos;t set up yet</p>
              <p className="mt-1">
                Add <code className="rounded bg-[var(--surface-raised)] px-1">AUTH_GOOGLE_ID</code>{" "}
                and{" "}
                <code className="rounded bg-[var(--surface-raised)] px-1">AUTH_GOOGLE_SECRET</code>{" "}
                to your environment, then restart. See <code>README.md</code> for the five-minute
                walkthrough.
              </p>
            </div>
          )}

          {devLogin && (
            <form action="/api/dev-login" method="post" className="mt-6 border-t border-[var(--surface-border)] pt-6">
              <p className="label">Local testing sign-in (development only)</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="field"
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  required
                />
                <button type="submit" className="btn btn-secondary">
                  Sign in
                </button>
              </div>
              <p className="mt-2 text-xs muted">
                This shortcut is disabled automatically in production builds.
              </p>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs muted">
          By continuing you agree to keep the receipts. We only store what you enter.
        </p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.2 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.9l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.9 35.9 44 30.6 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
