import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/form";
import { prisma } from "@/lib/db";
import { confirmEmailAction } from "@/server/actions/auth";
import { BrandMark } from "@/components/BrandMark";

export const metadata = { title: "Confirm your email" };

const VERIFY_PREFIX = "verify-email:";

/**
 * Where the confirmation email lands.
 *
 * The page only looks the token up; the button is what spends it. Mail clients
 * and link scanners fetch URLs to preview them, and a one-shot link that
 * confirms on sight would already be used up by the time its owner tapped it.
 */
export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const record = await prisma.verificationToken.findUnique({ where: { token } });
  const valid =
    record !== null && record.identifier.startsWith(VERIFY_PREFIX) && record.expires > new Date();
  const email = record ? record.identifier.slice(VERIFY_PREFIX.length) : null;

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <BrandMark size={40} />
          <span className="text-xl font-bold tracking-tight">Splitwise Killer</span>
        </Link>

        <div className="card animate-rise p-7">
          {valid ? (
            <>
              <h1 className="text-xl font-bold">Confirm {email}</h1>
              <p className="mt-2 text-sm muted">
                Expenses have already been split with this address. Confirm it&apos;s yours and
                they&apos;ll be waiting for you inside.
              </p>

              <ActionForm action={confirmEmailAction} className="mt-6">
                <input type="hidden" name="token" value={token} />
                <SubmitButton className="btn btn-primary w-full py-3" pendingLabel="Confirming…">
                  Yes, this is my email
                </SubmitButton>
              </ActionForm>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold">This link has expired</h1>
              <p className="mt-2 text-sm muted">
                Confirmation links last 24 hours and can only be used once. Sign up again and
                we&apos;ll send a fresh one.
              </p>
              <Link href="/login" className="btn btn-secondary mt-5">
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
