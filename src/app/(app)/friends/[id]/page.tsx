import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { CopyField } from "@/components/CopyField";
import { ExpenseList } from "@/components/ExpenseList";
import { Money } from "@/components/Money";
import { SubmitButton } from "@/components/form";
import { prisma } from "@/lib/db";
import { inviteLink } from "@/lib/people";
import { getSharedExpenses, userPairBalances } from "@/lib/queries";
import { displayName, requireUser } from "@/lib/session";
import { removeFriendAction } from "@/server/actions/friends";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
  return { title: person?.name ?? person?.email ?? "Friend" };
}

export default async function FriendPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (id === user.id) notFound();

  const person = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, image: true, isPlaceholder: true },
  });
  if (!person) notFound();

  const [expenses, pairs, invite] = await Promise.all([
    getSharedExpenses(user.id, person.id),
    userPairBalances(user.id),
    person.isPlaceholder
      ? prisma.invitation.findFirst({
          where: { targetUserId: person.id, acceptedAt: null },
          orderBy: { createdAt: "desc" },
          select: { token: true },
        })
      : Promise.resolve(null),
  ]);

  const balances: { currency: string; netCents: number }[] = [];
  for (const [currency, bucket] of pairs) {
    const value = bucket.get(person.id);
    if (value) balances.push({ currency, netCents: value });
  }

  const name = displayName(person);

  return (
    <>
      <PageHeader
        back={{ href: "/friends", label: "Friends" }}
        title={
          <span className="flex items-center gap-2.5">
            <Avatar id={person.id} name={name} image={person.image} size={44} />
            {name}
          </span>
        }
        subtitle={
          <>
            {person.email ?? person.phone ?? "no contact details"}
            {person.isPlaceholder && " · invited, hasn't signed in yet"}
          </>
        }
        action={
          <div className="flex gap-2">
            <Link href={`/friends/${person.id}/settle`} className="btn btn-secondary">
              Settle up
            </Link>
            <Link href={`/expenses/new?friendId=${person.id}`} className="btn btn-primary">
              + Add expense
            </Link>
          </div>
        }
      />

      <div className="card animate-rise mb-5 px-4 py-3">
        {balances.length === 0 ? (
          <p className="text-sm muted">You&apos;re all settled up with {name}.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            {balances.map((balance) => (
              <p key={balance.currency} className="text-sm">
                <span className="muted">
                  {balance.netCents > 0 ? `${name} owes you ` : `You owe ${name} `}
                </span>
                <Money cents={balance.netCents} currency={balance.currency} className="text-base" />
              </p>
            ))}
          </div>
        )}
      </div>

      {person.isPlaceholder && invite && (
        <div className="card mb-5 p-4">
          <h2 className="mb-1 font-semibold">Invite {name}</h2>
          <p className="mb-3 text-sm muted">
            Send them this link. When they sign in with Google, everything you&apos;ve split with
            them is already there.
          </p>
          <CopyField label="Invite link" value={inviteLink(invite.token)} />
        </div>
      )}

      {expenses.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="Nothing shared yet"
          body={`Add an expense with ${name} and it will show up here.`}
          action={
            <Link href={`/expenses/new?friendId=${person.id}`} className="btn btn-primary mt-2">
              Add an expense
            </Link>
          }
        />
      ) : (
        <ExpenseList expenses={expenses} selfId={user.id} showGroup />
      )}

      <div className="mt-8">
        <ActionForm
          action={removeFriendAction}
          confirm={`Remove ${name} from your friends list?`}
        >
          <input type="hidden" name="friendId" value={person.id} />
          <SubmitButton className="btn btn-ghost text-xs" pendingLabel="Removing…">
            Remove from friends
          </SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
