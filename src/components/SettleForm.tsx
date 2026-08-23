import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./form";
import { CURRENCIES } from "@/lib/currencies";
import { centsToDecimalString, formatMoney } from "@/lib/money";
import { displayName } from "@/lib/session";
import { recordPaymentAction } from "@/server/actions/settle";

export type SettlePerson = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

/**
 * "Record a payment" — the settle-up flow. Prefilled from a balance row so the
 * common case is two taps.
 */
export function SettleForm({
  people,
  selfId,
  groupId,
  defaults,
  cancelHref,
  suggestions = [],
}: {
  people: SettlePerson[];
  selfId: string;
  groupId?: string;
  defaults: { from: string; to: string; amount?: number; currency: string; date: string };
  cancelHref: string;
  suggestions?: { from: string; to: string; amountCents: number; currency: string }[];
}) {
  return (
    <div className="max-w-xl">
      {suggestions.length > 0 && (
        <div className="card mb-4 p-4">
          <p className="label">Suggested</p>
          <ul className="flex flex-col gap-2">
            {suggestions.map((suggestion, index) => {
              const from = people.find((p) => p.id === suggestion.from);
              const to = people.find((p) => p.id === suggestion.to);
              if (!from || !to) return null;
              const href = `?from=${suggestion.from}&to=${suggestion.to}&amount=${suggestion.amountCents}&currency=${suggestion.currency}`;
              return (
                <li key={index}>
                  <a href={href} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-raised)] px-3 py-2 text-sm hover:opacity-90">
                    <span>
                      <span className="font-medium">{displayName(from, selfId, from.id)}</span>
                      <span className="muted"> pays </span>
                      <span className="font-medium">{displayName(to, selfId, to.id)}</span>
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(suggestion.amountCents, suggestion.currency)}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ActionForm action={recordPaymentAction} className="flex flex-col gap-5" messagePosition="above">
        {groupId && <input type="hidden" name="groupId" value={groupId} />}

        <section className="card flex flex-col gap-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="fromUserId">
                Who paid
              </label>
              <select
                id="fromUserId"
                name="fromUserId"
                className="field"
                defaultValue={defaults.from}
              >
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {displayName(person, selfId, person.id)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="toUserId">
                Who received it
              </label>
              <select id="toUserId" name="toUserId" className="field" defaultValue={defaults.to}>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {displayName(person, selfId, person.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-28 shrink-0">
              <label className="label" htmlFor="currency">
                Currency
              </label>
              <select
                id="currency"
                name="currency"
                className="field"
                defaultValue={defaults.currency}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-1">
              <label className="label" htmlFor="amount">
                Amount
              </label>
              <input
                id="amount"
                name="amount"
                className="field text-xl font-semibold tabular-nums"
                inputMode="decimal"
                placeholder="0.00"
                defaultValue={
                  defaults.amount ? centsToDecimalString(defaults.amount, defaults.currency) : ""
                }
                required
              />
            </div>
            <div className="w-40 shrink-0">
              <label className="label" htmlFor="date">
                Date
              </label>
              <input
                id="date"
                name="date"
                type="date"
                className="field"
                defaultValue={defaults.date}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="note">
              Note (optional)
            </label>
            <input
              id="note"
              name="note"
              className="field"
              placeholder="UPI, cash, bank transfer…"
              maxLength={120}
            />
          </div>
        </section>

        <div className="flex gap-3">
          <SubmitButton className="btn btn-primary flex-1 py-3" pendingLabel="Recording…">
            Record payment
          </SubmitButton>
          <a href={cancelHref} className="btn btn-secondary py-3">
            Cancel
          </a>
        </div>
      </ActionForm>
    </div>
  );
}
