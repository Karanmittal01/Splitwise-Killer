import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { AvatarStack } from "@/components/Avatar";
import { ExpenseList } from "@/components/ExpenseList";
import { Money } from "@/components/Money";
import { CATEGORIES, category } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { getGroupBalances, getGroupExpenses, getGroupOrThrow } from "@/lib/queries";
import { displayName, requireUser } from "@/lib/session";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const group = await getGroupOrThrow(id, user.id);
  return { title: group?.name ?? "Group" };
}

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const filters = await searchParams;

  const group = await getGroupOrThrow(id, user.id);
  if (!group) notFound();

  const [balances, expenses] = await Promise.all([
    getGroupBalances(group.id, group.simplifyDebts),
    getGroupExpenses(group.id, { search: filters.q, category: filters.category }),
  ]);

  const members = group.members.map((m) => m.user);
  const memberById = new Map(members.map((m) => [m.id, m]));
  // Balances always reflect the whole group, never the filtered list below.
  const yourSummary = balances.summaryFor(user.id);

  const isFiltered = Boolean(filters.q || filters.category);
  const usedCategories = [...new Set(balances.expenses.map((e) => e.category))];

  return (
    <>
      <PageHeader
        back={{ href: "/groups", label: "Groups" }}
        title={
          <span className="flex items-center gap-2.5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--brand-soft)] text-2xl">
              {group.emoji}
            </span>
            {group.name}
          </span>
        }
        subtitle={
          <span className="flex items-center gap-2">
            <AvatarStack
              people={members.map((m) => ({ id: m.id, name: displayName(m), image: m.image }))}
            />
            {members.length} {members.length === 1 ? "member" : "members"}
            {group.archived && " · archived"}
          </span>
        }
        action={
          <div className="flex gap-2">
            <Link href={`/groups/${group.id}/settle`} className="btn btn-secondary">
              Settle up
            </Link>
            <Link href={`/expenses/new?groupId=${group.id}`} className="btn btn-primary">
              + Add expense
            </Link>
            <Link
              href={`/groups/${group.id}/settings`}
              className="btn btn-secondary"
              aria-label="Group settings"
            >
              ⚙️
            </Link>
          </div>
        }
      />

      {/* Your position */}
      <div className="card animate-rise mb-5 px-4 py-3">
        {yourSummary.length === 0 ? (
          <p className="text-sm muted">You&apos;re all settled up in this group. 🎉</p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            {yourSummary.map((summary) => (
              <p key={summary.currency} className="text-sm">
                <span className="muted">
                  {summary.netCents > 0 ? "Overall, you are owed " : "Overall, you owe "}
                </span>
                <Money cents={summary.netCents} currency={summary.currency} className="text-base" />
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Expenses */}
        <div className="min-w-0 lg:order-1">
          <form className="mb-4 flex flex-wrap items-center gap-2" action={`/groups/${group.id}`}>
            <div className="min-w-44 flex-1">
              <input
                name="q"
                className="field"
                placeholder="Search expenses…"
                defaultValue={filters.q ?? ""}
              />
            </div>
            <div className="w-44">
              <select name="category" className="field" defaultValue={filters.category ?? ""}>
                <option value="">All categories</option>
                {CATEGORIES.filter((c) => usedCategories.includes(c.id)).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-secondary">
              Filter
            </button>
            {isFiltered && (
              <Link href={`/groups/${group.id}`} className="btn btn-ghost">
                Clear
              </Link>
            )}
            <a href={`/groups/${group.id}/export`} className="btn btn-ghost" title="Download CSV">
              ⬇ CSV
            </a>
          </form>

          {expenses.length === 0 ? (
            <EmptyState
              icon={isFiltered ? "🔍" : "🧾"}
              title={isFiltered ? "Nothing matches that" : "No expenses yet"}
              body={
                isFiltered
                  ? "Try a different search or clear the filter."
                  : "Add the first one and everyone's balance updates instantly."
              }
              action={
                !isFiltered && (
                  <Link href={`/expenses/new?groupId=${group.id}`} className="btn btn-primary mt-2">
                    Add an expense
                  </Link>
                )
              }
            />
          ) : (
            <ExpenseList expenses={expenses} selfId={user.id} />
          )}
        </div>

        {/* Balances sidebar */}
        <aside className="lg:order-2">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] px-4 py-3">
              <h2 className="font-semibold">Balances</h2>
              {group.simplifyDebts && <span className="chip">simplified</span>}
            </div>

            {balances.debts.every((bucket) => bucket.debts.length === 0) ? (
              <p className="px-4 py-5 text-sm muted">Everyone is square. Nothing to settle.</p>
            ) : (
              <div className="divide-row">
                {balances.debts.map((bucket) =>
                  bucket.debts.map((debt, index) => {
                    const from = memberById.get(debt.fromUserId);
                    const to = memberById.get(debt.toUserId);
                    if (!from || !to) return null;
                    const involvesYou = debt.fromUserId === user.id || debt.toUserId === user.id;
                    return (
                      <div
                        key={`${bucket.currency}-${index}`}
                        className={`px-4 py-3 text-sm ${involvesYou ? "" : "muted"}`}
                      >
                        <p>
                          <span className="font-medium">
                            {displayName(from, user.id, from.id)}
                          </span>{" "}
                          <span className="muted">owes</span>{" "}
                          <span className="font-medium">{displayName(to, user.id, to.id)}</span>
                        </p>
                        <div className="mt-1 flex items-center justify-between">
                          <span
                            className={`font-semibold tabular-nums ${
                              debt.toUserId === user.id
                                ? "text-[var(--positive)]"
                                : debt.fromUserId === user.id
                                  ? "text-[var(--negative)]"
                                  : ""
                            }`}
                          >
                            {formatMoney(debt.amountCents, bucket.currency)}
                          </span>
                          {involvesYou && (
                            <Link
                              href={`/groups/${group.id}/settle?from=${debt.fromUserId}&to=${debt.toUserId}&amount=${debt.amountCents}&currency=${bucket.currency}`}
                              className="text-xs font-semibold text-[var(--brand)] hover:underline"
                            >
                              Settle
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  }),
                )}
              </div>
            )}
          </div>

          {/* Totals */}
          {balances.expenses.length > 0 && (
            <div className="card mt-4 p-4">
              <h2 className="mb-3 font-semibold">Group totals</h2>
              <GroupTotals expenses={balances.expenses} selfId={user.id} />
            </div>
          )}

          <div className="card mt-4 p-4">
            <h2 className="mb-3 font-semibold">Members</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {members.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{displayName(member, user.id, member.id)}</span>
                  {member.isPlaceholder && <span className="chip shrink-0">invited</span>}
                </li>
              ))}
            </ul>
            <Link
              href={`/groups/${group.id}/settings`}
              className="mt-3 inline-block text-sm text-[var(--brand)] hover:underline"
            >
              + Add people
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}

function GroupTotals({
  expenses,
  selfId,
}: {
  expenses: {
    currency: string;
    amountCents: number;
    isPayment: boolean;
    category: string;
    shares: { userId: string; owedCents: number; paidCents: number }[];
  }[];
  selfId: string;
}) {
  const totals = new Map<string, { spent: number; yourShare: number }>();
  const byCategory = new Map<string, Map<string, number>>();

  for (const expense of expenses) {
    if (expense.isPayment) continue;
    const bucket = totals.get(expense.currency) ?? { spent: 0, yourShare: 0 };
    bucket.spent += expense.amountCents;
    bucket.yourShare += expense.shares.find((s) => s.userId === selfId)?.owedCents ?? 0;
    totals.set(expense.currency, bucket);

    const catBucket = byCategory.get(expense.category) ?? new Map<string, number>();
    catBucket.set(expense.currency, (catBucket.get(expense.currency) ?? 0) + expense.amountCents);
    byCategory.set(expense.category, catBucket);
  }

  const topCategories = [...byCategory.entries()]
    .sort((a, b) => {
      const aMax = Math.max(...a[1].values());
      const bMax = Math.max(...b[1].values());
      return bMax - aMax;
    })
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-3 text-sm">
      {[...totals.entries()].map(([currency, bucket]) => (
        <div key={currency} className="flex items-center justify-between">
          <span className="muted">Total spent</span>
          <span className="font-semibold tabular-nums">{formatMoney(bucket.spent, currency)}</span>
        </div>
      ))}
      {[...totals.entries()].map(([currency, bucket]) => (
        <div key={`${currency}-you`} className="flex items-center justify-between">
          <span className="muted">Your share</span>
          <span className="font-semibold tabular-nums">
            {formatMoney(bucket.yourShare, currency)}
          </span>
        </div>
      ))}

      {topCategories.length > 0 && (
        <div className="mt-1 border-t border-[var(--surface-border)] pt-3">
          <p className="mb-2 text-xs font-semibold tracking-wide muted uppercase">Top categories</p>
          <ul className="flex flex-col gap-1.5">
            {topCategories.map(([catId, amounts]) => (
              <li key={catId} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {category(catId).icon} {category(catId).label}
                </span>
                <span className="shrink-0 tabular-nums muted">
                  {[...amounts.entries()]
                    .map(([currency, cents]) => formatMoney(cents, currency))
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
