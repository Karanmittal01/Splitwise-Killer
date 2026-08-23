import { notFound } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { SettleForm } from "@/components/SettleForm";
import { getGroupBalances, getGroupOrThrow } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Settle up" };

export default async function GroupSettlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; amount?: string; currency?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;

  const group = await getGroupOrThrow(id, user.id);
  if (!group) notFound();

  const balances = await getGroupBalances(group.id, group.simplifyDebts);
  const members = group.members.map((m) => m.user);

  // Everything involving you first — that's what people settle most often.
  const suggestions = balances.debts
    .flatMap((bucket) =>
      bucket.debts.map((debt) => ({
        from: debt.fromUserId,
        to: debt.toUserId,
        amountCents: debt.amountCents,
        currency: bucket.currency,
      })),
    )
    .sort((a, b) => {
      const aMine = a.from === user.id || a.to === user.id ? 0 : 1;
      const bMine = b.from === user.id || b.to === user.id ? 0 : 1;
      return aMine - bMine || b.amountCents - a.amountCents;
    })
    .slice(0, 6);

  const fallback = suggestions.find((s) => s.from === user.id) ?? suggestions[0];

  return (
    <>
      <PageHeader
        title="Settle up"
        subtitle={`Record a payment in ${group.name}.`}
        back={{ href: `/groups/${group.id}`, label: group.name }}
      />

      <SettleForm
        people={members}
        selfId={user.id}
        groupId={group.id}
        cancelHref={`/groups/${group.id}`}
        suggestions={suggestions}
        defaults={{
          from: query.from ?? fallback?.from ?? user.id,
          to:
            query.to ??
            fallback?.to ??
            members.find((m) => m.id !== user.id)?.id ??
            user.id,
          amount: query.amount ? Number(query.amount) : fallback?.amountCents,
          currency: query.currency ?? fallback?.currency ?? group.currency,
          date: new Date().toISOString().slice(0, 10),
        }}
      />
    </>
  );
}
