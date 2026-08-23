import { notFound } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { SettleForm } from "@/components/SettleForm";
import { prisma } from "@/lib/db";
import { userPairBalances } from "@/lib/queries";
import { displayName, requireUser } from "@/lib/session";

export const metadata = { title: "Settle up" };

export default async function FriendSettlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; amount?: string; currency?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  if (id === user.id) notFound();

  const person = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true },
  });
  if (!person) notFound();

  const pairs = await userPairBalances(user.id);
  const suggestions: { from: string; to: string; amountCents: number; currency: string }[] = [];
  for (const [currency, bucket] of pairs) {
    const value = bucket.get(person.id);
    if (!value) continue;
    suggestions.push(
      value > 0
        ? { from: person.id, to: user.id, amountCents: value, currency }
        : { from: user.id, to: person.id, amountCents: -value, currency },
    );
  }

  const first = suggestions[0];
  const self = { id: user.id, name: user.name, email: user.email, phone: user.phone };

  return (
    <>
      <PageHeader
        title="Settle up"
        subtitle={`Record a payment with ${displayName(person)}.`}
        back={{ href: `/friends/${person.id}`, label: displayName(person) }}
      />

      <SettleForm
        people={[self, person]}
        selfId={user.id}
        cancelHref={`/friends/${person.id}`}
        suggestions={suggestions}
        defaults={{
          from: query.from ?? first?.from ?? user.id,
          to: query.to ?? first?.to ?? person.id,
          amount: query.amount ? Number(query.amount) : first?.amountCents,
          currency: query.currency ?? first?.currency ?? user.defaultCurrency,
          date: new Date().toISOString().slice(0, 10),
        }}
      />
    </>
  );
}
