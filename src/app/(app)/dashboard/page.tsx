import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Money } from "@/components/Money";
import { getDashboard } from "@/lib/queries";
import { displayName, requireUser } from "@/lib/session";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const { totals, perPerson, groups } = await getDashboard(user.id);

  const owedToYou = totals.filter((t) => t.owedToYouCents > 0);
  const youOwe = totals.filter((t) => t.youOweCents > 0);

  return (
    <>
      <PageHeader
        title={`Hi ${displayName(user).split(" ")[0]} 👋`}
        subtitle="Here's where you stand right now."
        action={
          <Link href="/expenses/new" className="btn btn-primary hidden md:inline-flex">
            + Add an expense
          </Link>
        }
      />

      {/* Headline totals */}
      <div className="card animate-rise mb-6 overflow-hidden">
        <div className="grid gap-px bg-[var(--surface-border)] sm:grid-cols-3">
          <SummaryTile label="Total balance" items={totals.map((t) => ({ currency: t.currency, cents: t.netCents }))} tone="auto" />
          <SummaryTile
            label="You are owed"
            items={owedToYou.map((t) => ({ currency: t.currency, cents: t.owedToYouCents }))}
            tone="positive"
          />
          <SummaryTile
            label="You owe"
            items={youOwe.map((t) => ({ currency: t.currency, cents: t.youOweCents }))}
            tone="negative"
          />
        </div>
      </div>

      {/* Balances per person */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Balances</h2>
          <Link href="/friends" className="text-sm text-[var(--brand)] hover:underline">
            All friends
          </Link>
        </div>

        {perPerson.length === 0 ? (
          <EmptyState
            icon="🎉"
            title="You're all settled up"
            body="Nobody owes anybody anything. Add an expense to get the ball rolling."
            action={
              <Link href="/expenses/new" className="btn btn-primary mt-2">
                Add an expense
              </Link>
            }
          />
        ) : (
          <div className="card divide-row">
            {perPerson.map(({ person, amounts }) => {
              const name = displayName(person);
              return (
                <Link
                  key={person.id}
                  href={`/friends/${person.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-raised)]"
                >
                  <Avatar id={person.id} name={name} image={person.image} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{name}</p>
                    {person.isPlaceholder && (
                      <span className="text-xs muted">invited · hasn&apos;t signed in yet</span>
                    )}
                  </div>
                  <div className="text-right">
                    {amounts.map((amount) => (
                      <div key={amount.currency} className="text-sm">
                        <span className="muted">
                          {amount.netCents > 0 ? "owes you " : "you owe "}
                        </span>
                        <Money cents={amount.netCents} currency={amount.currency} />
                      </div>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Groups */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your groups</h2>
          <Link href="/groups/new" className="text-sm text-[var(--brand)] hover:underline">
            + New group
          </Link>
        </div>

        {groups.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No groups yet"
            body="Groups keep a trip, a flat or a dinner club in one place with its own running balance."
            action={
              <Link href="/groups/new" className="btn btn-primary mt-2">
                Create a group
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="card flex items-center gap-3 p-4 transition-colors hover:bg-[var(--surface-raised)]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-xl">
                  {group.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{group.name}</p>
                  <p className="text-xs muted">
                    {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
                <div className="text-right text-sm">
                  {group.yourBalances.length === 0 ? (
                    <span className="muted">settled up</span>
                  ) : (
                    group.yourBalances.map((balance) => (
                      <div key={balance.currency}>
                        <span className="block text-[11px] muted">
                          {balance.netCents > 0 ? "you are owed" : "you owe"}
                        </span>
                        <Money cents={balance.netCents} currency={balance.currency} />
                      </div>
                    ))
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function SummaryTile({
  label,
  items,
  tone,
}: {
  label: string;
  items: { currency: string; cents: number }[];
  tone: "auto" | "positive" | "negative";
}) {
  return (
    <div className="bg-[var(--surface-card)] px-5 py-4">
      <p className="text-xs font-semibold tracking-wide muted uppercase">{label}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-xl font-semibold muted">—</p>
      ) : (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
          {items.map((item) => (
            <Money
              key={item.currency}
              cents={item.cents}
              currency={item.currency}
              tone={tone}
              className="text-xl"
            />
          ))}
        </div>
      )}
    </div>
  );
}
