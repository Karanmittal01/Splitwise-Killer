"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/money";

export type ShareableExpense = {
  id: string;
  description: string;
  date: string;
  amountCents: number;
  currency: string;
  /** Your position on it: positive = you lent, negative = you borrowed. */
  netCents: number;
  isPayment: boolean;
};

/**
 * Pick transactions and send the list to somebody over WhatsApp.
 *
 * The message is plain text built here on the phone — no server round trip,
 * nothing rendered as an image, so it stays readable and quotable in the chat.
 */
export function ShareTransactions({
  expenses,
  friendName,
  friendPhone,
  balanceLine,
}: {
  expenses: ShareableExpense[];
  friendName: string;
  friendPhone?: string | null;
  balanceLine: string;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(expenses.map((e) => e.id)));

  const allSelected = selected.size === expenses.length && expenses.length > 0;

  const message = useMemo(() => {
    const lines = [`Expenses with ${friendName}`, ""];
    for (const expense of expenses) {
      if (!selected.has(expense.id)) continue;
      const position =
        expense.netCents === 0
          ? ""
          : expense.netCents > 0
            ? ` — you lent ${formatMoney(Math.abs(expense.netCents), expense.currency)}`
            : ` — you borrowed ${formatMoney(Math.abs(expense.netCents), expense.currency)}`;
      lines.push(
        `${expense.date}  ${expense.description} · ${formatMoney(expense.amountCents, expense.currency)}${position}`,
      );
    }
    lines.push("", balanceLine);
    return lines.join("\n");
  }, [expenses, selected, friendName, balanceLine]);

  const digits = friendPhone?.replace(/\D/g, "") ?? "";
  const whatsappUrl = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (expenses.length === 0) return null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary text-sm">
        ↗ Share list
      </button>
    );
  }

  return (
    <div className="card mb-5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Share transactions</h2>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost text-xs">
          Close
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm muted">
          {selected.size} of {expenses.length} selected
        </p>
        <button
          type="button"
          onClick={() => setSelected(allSelected ? new Set() : new Set(expenses.map((e) => e.id)))}
          className="text-sm text-[var(--brand)] hover:underline"
        >
          {allSelected ? "Clear all" : "Select all"}
        </button>
      </div>

      <div className="divide-row mb-3 max-h-72 overflow-y-auto rounded-xl border border-[var(--surface-border)]">
        {expenses.map((expense) => (
          <label
            key={expense.id}
            className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-[var(--surface-raised)]"
          >
            <input
              type="checkbox"
              checked={selected.has(expense.id)}
              onChange={() => toggle(expense.id)}
              className="h-4 w-4 shrink-0 accent-[var(--color-mint-600)]"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{expense.description}</span>
              <span className="block text-xs muted">
                {expense.date} · {formatMoney(expense.amountCents, expense.currency)}
              </span>
            </span>
            <span
              className={`shrink-0 text-sm font-semibold tabular-nums ${
                expense.netCents > 0
                  ? "text-[var(--positive)]"
                  : expense.netCents < 0
                    ? "text-[var(--negative)]"
                    : "muted"
              }`}
            >
              {expense.netCents === 0
                ? "—"
                : formatMoney(Math.abs(expense.netCents), expense.currency)}
            </span>
          </label>
        ))}
      </div>

      <details className="mb-3">
        <summary className="cursor-pointer text-sm muted">Preview message</summary>
        <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-[var(--surface-raised)] p-3 text-xs whitespace-pre-wrap">
          {message}
        </pre>
      </details>

      <div className="flex flex-wrap gap-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className={`btn btn-primary text-sm ${selected.size === 0 ? "pointer-events-none opacity-50" : ""}`}
        >
          Send on WhatsApp
        </a>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(message)}
          className="btn btn-secondary text-sm"
        >
          Copy text
        </button>
      </div>
    </div>
  );
}
