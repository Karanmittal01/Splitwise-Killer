import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { ExpenseList } from "@/components/ExpenseList";
import { Money } from "@/components/Money";
import { FriendNameHeading } from "@/components/FriendNameHeading";
import { ShareInvite } from "@/components/ShareInvite";
import { ShareTransactions, type ShareableExpense } from "@/components/ShareTransactions";
import { SubmitButton } from "@/components/form";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { inviteLink } from "@/lib/people";
import { getNicknames, getSharedExpenses, userPairBalances } from "@/lib/queries";
import { displayName, requireUser } from "@/lib/session";
import { removeFriendAction } from "@/server/actions/friends";

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

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

  const [expenses, pairs, invite, nicknames] = await Promise.all([
    getSharedExpenses(user.id, person.id),
    userPairBalances(user.id),
    person.isPlaceholder
      ? prisma.invitation.findFirst({
          where: { targetUserId: person.id, acceptedAt: null },
          orderBy: { createdAt: "desc" },
          select: { token: true, email: true },
        })
      : Promise.resolve(null),
    getNicknames(user.id),
  ]);

  const nickname = nicknames.get(person.id) ?? null;
  const realName = displayName(person);
  const name = nickname ?? realName;

  const balances: { currency: string; netCents: number }[] = [];
  for (const [currency, bucket] of pairs) {
    const value = bucket.get(person.id);
    if (value) balances.push({ currency, netCents: value });
  }

  const balanceLine =
    balances.length === 0
      ? "We're all settled up."
      : balances
          .map((b) =>
            b.netCents > 0
              ? `You are owed ${formatMoney(b.netCents, b.currency)}.`
              : `You owe ${formatMoney(-b.netCents, b.currency)}.`,
          )
          .join(" ");

  const shareable: ShareableExpense[] = expenses.map((expense) => {
    const mine = expense.shares.find((s) => s.userId === user.id);
    return {
      id: expense.id,
      description: expense.description,
      date: shortDate.format(expense.date),
      amountCents: expense.amountCents,
      currency: expense.currency,
      netCents: (mine?.paidCents ?? 0) - (mine?.owedCents ?? 0),
      isPayment: expense.isPayment,
    };
  });

  return (
    <>
      <PageHeader
        back={{ href: "/friends", label: "Friends" }}
        title={
          <FriendNameHeading
            friendId={person.id}
            name={name}
            realName={realName}
            nickname={nickname}
            image={person.image}
          />
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2">
            {nickname && <span>{realName} ·</span>}
            {person.email ?? person.phone ?? "no contact details"}
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/friends/${person.id}/settle`} className="btn btn-secondary">
              Settle up
            </Link>
            <Link href={`/expenses/new?friendId=${person.id}`} className="btn btn-primary">
              + Add expense
            </Link>
          </div>
        }
      />

      {/* Balance and the share-list action share one compact row. */}
      <div className="card animate-rise mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
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
        <ShareTransactions
          expenses={shareable}
          friendName={name}
          friendPhone={person.phone}
          balanceLine={balanceLine}
        />
      </div>

      {person.isPlaceholder && invite && (
        <div className="card mb-5 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">{name} hasn&apos;t signed in yet</p>
            <p className="text-xs muted">Send them a link — they sign in with Google to see their share.</p>
          </div>
          <ShareInvite
            link={inviteLink(invite.token)}
            name={name}
            phone={person.phone}
            email={invite.email ?? person.email}
            compact
          />
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
        <ActionForm action={removeFriendAction} confirm={`Remove ${name} from your friends list?`}>
          <input type="hidden" name="friendId" value={person.id} />
          <SubmitButton className="btn btn-ghost text-xs" pendingLabel="Removing…">
            Remove from friends
          </SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
