import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { AvatarStack } from "@/components/Avatar";
import { SubmitButton } from "@/components/form";
import { prisma } from "@/lib/db";
import { displayName, getCurrentUser } from "@/lib/session";
import { joinGroupByTokenAction } from "@/server/actions/invites";
import { BrandMark } from "@/components/BrandMark";

export const metadata = { title: "Join a group" };

/** Landing page for a group's shareable link. */
export default async function JoinGroupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const group = await prisma.group.findUnique({
    where: { inviteToken: token },
    select: {
      id: true,
      name: true,
      emoji: true,
      members: {
        select: { user: { select: { id: true, name: true, email: true, phone: true, image: true } } },
      },
    },
  });

  const user = await getCurrentUser();
  const alreadyIn = group?.members.some((m) => m.user.id === user?.id);

  return (
    <div className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <BrandMark size={40} />
          <span className="text-xl font-bold tracking-tight">Splitwise Killer</span>
        </Link>

        <div className="card animate-rise p-7 text-center">
          {!group ? (
            <>
              <h1 className="text-xl font-bold">This group link isn&apos;t valid</h1>
              <p className="mt-2 text-sm muted">
                It may have been reset. Ask someone in the group for a new one.
              </p>
              <Link href="/" className="btn btn-secondary mt-5">
                Go home
              </Link>
            </>
          ) : (
            <>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--brand-soft)] text-3xl">
                {group.emoji}
              </span>
              <h1 className="mt-4 text-xl font-bold">{group.name}</h1>
              <p className="mt-1 text-sm muted">
                {group.members.length} {group.members.length === 1 ? "member" : "members"}
              </p>
              <div className="mt-3 flex justify-center">
                <AvatarStack
                  people={group.members.map((m) => ({
                    id: m.user.id,
                    name: displayName(m.user),
                    image: m.user.image,
                  }))}
                />
              </div>

              {!user ? (
                <Link
                  href={`/login?next=${encodeURIComponent(`/join/group/${token}`)}`}
                  className="btn btn-primary mt-6 w-full py-3"
                >
                  Sign in with Google to join
                </Link>
              ) : alreadyIn ? (
                <Link href={`/groups/${group.id}`} className="btn btn-primary mt-6 w-full py-3">
                  You&apos;re already in — open the group
                </Link>
              ) : (
                <ActionForm action={joinGroupByTokenAction} className="mt-6">
                  <input type="hidden" name="token" value={token} />
                  <SubmitButton className="btn btn-primary w-full py-3" pendingLabel="Joining…">
                    Join this group
                  </SubmitButton>
                </ActionForm>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
