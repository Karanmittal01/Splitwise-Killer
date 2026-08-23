import Link from "next/link";
import { category } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { displayName } from "@/lib/session";

type ListShare = {
  userId: string;
  paidCents: number;
  owedCents: number;
  user: { id: string; name: string | null; email: string | null; phone: string | null };
};

export type ListExpense = {
  id: string;
  description: string;
  amountCents: number;
  currency: string;
  date: Date;
  category: string;
  isPayment: boolean;
  recurringOfId?: string | null;
  shares: ListShare[];
  group?: { id: string; name: string; emoji: string } | null;
  _count?: { comments: number };
  receipt?: { id: string } | null;
};

const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { month: "short" });

function monthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

/** The Splitwise-style ledger: grouped by month, your position on the right. */
export function ExpenseList({
  expenses,
  selfId,
  showGroup = false,
}: {
  expenses: ListExpense[];
  selfId: string;
  showGroup?: boolean;
}) {
  const months: { key: string; label: string; items: ListExpense[] }[] = [];
  for (const expense of expenses) {
    const key = monthKey(expense.date);
    const last = months[months.length - 1];
    if (last?.key === key) last.items.push(expense);
    else months.push({ key, label: monthFormat.format(expense.date), items: [expense] });
  }

  return (
    <div className="flex flex-col gap-5">
      {months.map((month) => (
        <div key={month.key}>
          <h3 className="mb-2 px-1 text-xs font-bold tracking-wider muted uppercase">
            {month.label}
          </h3>
          <div className="card divide-row">
            {month.items.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                selfId={selfId}
                showGroup={showGroup}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExpenseRow({
  expense,
  selfId,
  showGroup,
}: {
  expense: ListExpense;
  selfId: string;
  showGroup: boolean;
}) {
  const cat = category(expense.category);
  const mine = expense.shares.find((s) => s.userId === selfId);
  const net = (mine?.paidCents ?? 0) - (mine?.owedCents ?? 0);
  const payers = expense.shares.filter((s) => s.paidCents > 0);

  const paidBy =
    payers.length === 0
      ? "nobody"
      : payers.length === 1
        ? displayName(payers[0].user, selfId, payers[0].userId)
        : `${payers.length} people`;

  const receiver = expense.shares.find((s) => s.owedCents > 0);

  return (
    <Link
      href={`/expenses/${expense.id}`}
      className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-[var(--surface-raised)] sm:px-4"
    >
      <div className="w-9 shrink-0 text-center">
        <p className="text-[11px] font-semibold muted uppercase">{dayFormat.format(expense.date)}</p>
        <p className="text-lg leading-tight font-bold">{expense.date.getDate()}</p>
      </div>

      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-raised)] text-lg">
        {expense.isPayment ? "💸" : cat.icon}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {expense.description}
          {expense.recurringOfId && <span className="ml-1 text-xs muted">🔁</span>}
        </p>
        <p className="truncate text-xs muted">
          {expense.isPayment ? (
            <>
              {paidBy} paid {receiver ? displayName(receiver.user, selfId, receiver.userId) : "someone"}{" "}
              {formatMoney(expense.amountCents, expense.currency)}
            </>
          ) : (
            <>
              {paidBy} paid {formatMoney(expense.amountCents, expense.currency)}
            </>
          )}
          {showGroup && expense.group && ` · ${expense.group.emoji} ${expense.group.name}`}
          {expense._count?.comments ? ` · 💬 ${expense._count.comments}` : ""}
          {expense.receipt ? " · 📎" : ""}
        </p>
      </div>

      <div className="shrink-0 text-right">
        {net === 0 ? (
          <span className="text-xs muted">not involved</span>
        ) : (
          <>
            <p className="text-[11px] muted">
              {expense.isPayment ? (net > 0 ? "you paid" : "you received") : net > 0 ? "you lent" : "you borrowed"}
            </p>
            <p
              className={`tabular-nums font-semibold ${
                net > 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"
              }`}
            >
              {formatMoney(Math.abs(net), expense.currency)}
            </p>
          </>
        )}
      </div>
    </Link>
  );
}
