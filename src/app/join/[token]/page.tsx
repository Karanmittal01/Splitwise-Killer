import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/form";
import { prisma } from "@/lib/db";
import { getCurrentUser, displayName } from "@/lib/session";
import { claimInviteAction } from "@/server/actions/invites";
import { BrandMark } from "@/components/BrandMark";

export const metadata = { title: "You've been invited" };

/**
 * Landing page for a personal invite link. Signed out, it sends people to
 * Google sign-in and comes straight back here; signed in, one tap merges the
 * placeholder account that already holds their share.
 */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invite = await prisma.invitation.findUnique({
    where: { token },
    select: {
      email: true,
      phone: true,
      acceptedAt: true,
      invitedBy: { select: { id: true, name: true, email: true, phone: true } },
      group: { select: { id: true, name: true, emoji: true } },
    },
  });

  const user = await getCurrentUser();

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <BrandMark size={40} />
          <span className="text-xl font-bold tracking-tight">Splitwise Killer</span>
        </Link>

        <div className="card animate-rise p-7">
          {!invite ? (
            <>
              <h1 className="text-xl font-bold">This invite link isn&apos;t valid</h1>
              <p className="mt-2 text-sm muted">
                It may have been reset. Ask whoever invited you to send a fresh one.
              </p>
              <Link href="/" className="btn btn-secondary mt-5">
                Go home
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold">
                {displayName(invite.invitedBy)} added you
                {invite.group ? ` to ${invite.group.emoji} ${invite.group.name}` : ""}
              </h1>
              <p className="mt-2 text-sm muted">
                {invite.email ?? invite.phone
                  ? `The invite was sent to ${invite.email ?? invite.phone}. `
                  : ""}
                Accept it and any expenses already split with you will appear in your account.
              </p>

              {user ? (
                <ActionForm action={claimInviteAction} className="mt-6">
                  <input type="hidden" name="token" value={token} />
                  <SubmitButton className="btn btn-primary w-full py-3" pendingLabel="Setting up…">
                    Accept as {displayName(user)}
                  </SubmitButton>
                  <p className="mt-3 text-center text-xs muted">
                    Signed in as {user.email}.{" "}
                    <Link href="/account" className="underline">
                      Not you?
                    </Link>
                  </p>
                </ActionForm>
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}
                  className="btn btn-primary mt-6 w-full py-3"
                >
                  Sign in with Google to accept
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
