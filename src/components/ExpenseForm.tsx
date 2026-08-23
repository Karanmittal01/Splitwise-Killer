"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { CurrencySelect } from "./CurrencySelect";
import { FormMessage, SubmitButton } from "./form";
import { CATEGORIES, category as categoryById, guessCategory } from "@/lib/categories";
import { formatMoney, parseMoneyToCents } from "@/lib/money";
import { computeOwed, participantValue, SplitError } from "@/lib/split";
import { RECURRENCE_LABELS } from "@/lib/recurring";
import { quickAddPersonAction } from "@/server/actions/friends";
import { idleState, type ActionState } from "@/server/actions/types";
import type { SplitMethod, Recurrence } from "@/generated/prisma/enums";

export type FormPerson = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  isPlaceholder?: boolean;
};

export type FormGroup = {
  id: string;
  name: string;
  emoji: string;
  currency: string;
  members: FormPerson[];
};

export type ExpenseInitial = {
  id?: string;
  groupId: string | null;
  description: string;
  amount: string;
  currency: string;
  date: string;
  category: string;
  notes: string;
  splitMethod: SplitMethod;
  recurrence: Recurrence;
  participants: { userId: string; value: string }[];
  payers: { userId: string; amount: string }[];
  hasReceipt?: boolean;
};

const SPLIT_TABS: { id: SplitMethod; label: string; hint: string }[] = [
  { id: "EQUAL", label: "=", hint: "Split equally" },
  { id: "EXACT", label: "1.23", hint: "Exact amounts" },
  { id: "PERCENT", label: "%", hint: "By percentage" },
  { id: "SHARES", label: "⚖", hint: "By shares" },
  { id: "ADJUSTMENT", label: "+/−", hint: "Equally, with adjustments" },
];

function personName(person: FormPerson, selfId: string): string {
  if (person.id === selfId) return "You";
  return person.name?.trim() || person.email?.split("@")[0] || person.phone || "Someone";
}

export function ExpenseForm({
  self,
  connections,
  groups,
  initial,
  action,
  submitLabel,
  cancelHref,
}: {
  self: FormPerson;
  connections: FormPerson[];
  groups: FormGroup[];
  initial: ExpenseInitial;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, idleState);

  const [groupId, setGroupId] = useState(initial.groupId ?? "");
  const [description, setDescription] = useState(initial.description);
  const [amount, setAmount] = useState(initial.amount);
  const [currency, setCurrency] = useState(initial.currency);
  const [date, setDate] = useState(initial.date);
  const [cat, setCat] = useState(initial.category);
  const [catTouched, setCatTouched] = useState(initial.category !== "general");
  const [notes, setNotes] = useState(initial.notes);
  const [recurrence, setRecurrence] = useState<Recurrence>(initial.recurrence);
  const [showMore, setShowMore] = useState(
    Boolean(initial.notes) || initial.recurrence !== "NONE",
  );

  const [splitMethod, setSplitMethod] = useState<SplitMethod>(initial.splitMethod);
  const [selected, setSelected] = useState<string[]>(
    initial.participants.length > 0 ? initial.participants.map((p) => p.userId) : [self.id],
  );
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(initial.participants.map((p) => [p.userId, p.value])),
  );

  const [multiPayer, setMultiPayer] = useState(initial.payers.length > 1);
  const [payer, setPayer] = useState(initial.payers[0]?.userId ?? self.id);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>(
    Object.fromEntries(initial.payers.map((p) => [p.userId, p.amount])),
  );

  const [extraPeople, setExtraPeople] = useState<FormPerson[]>([]);
  const [inviteHandle, setInviteHandle] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, startInvite] = useTransition();

  const group = groups.find((g) => g.id === groupId) ?? null;

  // Who can appear on this expense.
  const roster: FormPerson[] = useMemo(() => {
    const byId = new Map<string, FormPerson>();
    byId.set(self.id, self);
    const source = group ? group.members : [...connections, ...extraPeople];
    for (const person of source) byId.set(person.id, person);
    // Anyone already on the expense stays selectable even if they left a group.
    for (const id of selected) if (!byId.has(id)) byId.set(id, { id, name: "Someone", email: null, phone: null, image: null });
    return [...byId.values()];
  }, [self, group, connections, extraPeople, selected]);

  const participants = useMemo(
    () => roster.filter((p) => selected.includes(p.id)),
    [roster, selected],
  );

  const totalCents = parseMoneyToCents(amount || "0", currency);
  const validTotal = Number.isFinite(totalCents) && totalCents > 0;

  // Live preview of what everybody ends up owing.
  const preview = useMemo(() => {
    if (!validTotal || participants.length === 0) return null;
    try {
      const owed = computeOwed(
        splitMethod,
        totalCents,
        participants.map((p) => ({
          userId: p.id,
          value: participantValue(splitMethod, values[p.id], currency),
        })),
      );
      return { owed: new Map(owed.map((o) => [o.userId, o.owedCents])), error: null as string | null };
    } catch (error) {
      return {
        owed: new Map<string, number>(),
        error: error instanceof SplitError ? error.message : "Check the split.",
      };
    }
  }, [splitMethod, totalCents, participants, values, currency, validTotal]);

  const payers = multiPayer
    ? participants
        .map((p) => ({ userId: p.id, amount: payerAmounts[p.id] ?? "" }))
        .filter((p) => parseMoneyToCents(p.amount || "0", currency) > 0)
    : [{ userId: payer, amount: amount || "0" }];

  const paidTotal = payers.reduce(
    (sum, p) => sum + (parseMoneyToCents(p.amount || "0", currency) || 0),
    0,
  );

  const payload = {
    groupId: groupId || null,
    description,
    amount,
    currency,
    date,
    category: cat,
    notes,
    splitMethod,
    recurrence,
    payers,
    participants: participants.map((p) => ({ userId: p.id, value: values[p.id] ?? "" })),
  };

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function onDescription(next: string) {
    setDescription(next);
    if (!catTouched) setCat(guessCategory(next));
  }

  function onGroupChange(next: string) {
    setGroupId(next);
    const target = groups.find((g) => g.id === next);
    if (target) {
      setCurrency(target.currency);
      setSelected(target.members.map((m) => m.id));
      if (!target.members.some((m) => m.id === payer)) setPayer(self.id);
    } else {
      setSelected((prev) => (prev.length > 0 ? prev : [self.id]));
    }
  }

  function invitePerson() {
    const handle = inviteHandle.trim();
    if (!handle) return;
    setInviteError(null);
    startInvite(async () => {
      const result = await quickAddPersonAction({ handle });
      if (!result.ok) {
        setInviteError(result.error);
        return;
      }
      setExtraPeople((prev) => [...prev, result.person]);
      setSelected((prev) => (prev.includes(result.person.id) ? prev : [...prev, result.person.id]));
      setInviteHandle("");
    });
  }

  const splitHint = SPLIT_TABS.find((t) => t.id === splitMethod)?.hint ?? "";

  // React picks the form encoding itself for server actions (files included),
  // so no encType here.
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      {initial.id && <input type="hidden" name="expenseId" value={initial.id} />}

      {/* ---------------- Group ---------------- */}
      <section className="card p-4">
        <span className="label">Group</span>
        <div className="flex flex-wrap gap-2">
          <GroupPill active={groupId === ""} onClick={() => onGroupChange("")} emoji="🙋">
            No group
          </GroupPill>
          {groups.map((g) => (
            <GroupPill
              key={g.id}
              active={groupId === g.id}
              onClick={() => onGroupChange(g.id)}
              emoji={g.emoji}
            >
              {g.name}
            </GroupPill>
          ))}
        </div>
      </section>

      {/* ---------------- What & how much ---------------- */}
      <section className="card flex flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <CategoryPicker value={cat} onChange={(id) => { setCat(id); setCatTouched(true); }} />
          <div className="min-w-0 flex-1">
            <label className="label" htmlFor="description">
              Description
            </label>
            <input
              id="description"
              className="field text-base"
              value={description}
              onChange={(e) => onDescription(e.target.value)}
              placeholder="Dinner at Toit"
              maxLength={120}
              required
            />
          </div>
        </div>

        {/* The amount is the point of this screen, so it gets the width.
            On a phone the date drops to its own row rather than squeezing it. */}
        <div className="grid grid-cols-[4.25rem_1fr] gap-3 sm:grid-cols-[4.25rem_1fr_10.5rem]">
          <CurrencySelect value={currency} onChange={setCurrency} />

          <div className="min-w-0">
            <label className="label" htmlFor="amount">
              Amount
            </label>
            <input
              id="amount"
              className="field text-2xl font-semibold tabular-nums"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              required
            />
          </div>

          <div className="col-span-2 min-w-0 sm:col-span-1">
            <label className="label" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              type="date"
              className="field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>
      </section>

      {/* ---------------- Who's in ---------------- */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="label mb-0">Split between</span>
          <span className="text-xs muted">
            {participants.length} {participants.length === 1 ? "person" : "people"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {roster.map((person) => {
            const on = selected.includes(person.id);
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => toggle(person.id)}
                className={`flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm font-medium transition-colors ${
                  on
                    ? "border-[var(--color-mint-400)] bg-[var(--brand-soft)] text-[var(--brand)]"
                    : "border-[var(--surface-border)] muted hover:bg-[var(--surface-raised)]"
                }`}
              >
                <Avatar id={person.id} name={personName(person, self.id)} image={person.image} size={24} />
                {personName(person, self.id)}
              </button>
            );
          })}
        </div>

        {!group && (
          <div className="mt-3 border-t border-[var(--surface-border)] pt-3">
            <span className="label">Add someone by email or mobile</span>
            <div className="flex flex-wrap gap-2">
              <input
                className="field max-w-xs flex-1"
                value={inviteHandle}
                onChange={(e) => setInviteHandle(e.target.value)}
                placeholder="friend@gmail.com or +91 98765 43210"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    invitePerson();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={invitePerson}
                disabled={inviting || inviteHandle.trim() === ""}
              >
                {inviting ? "Adding…" : "Add"}
              </button>
            </div>
            {inviteError && <p className="mt-2 text-sm text-[var(--negative)]">{inviteError}</p>}
            <p className="mt-2 text-xs muted">
              They don&apos;t need an account yet — their share waits for them until they sign in.
            </p>
          </div>
        )}
      </section>

      {/* ---------------- Paid by ---------------- */}
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="label mb-0">Paid by</span>
          <label className="flex items-center gap-2 text-sm muted">
            <input
              type="checkbox"
              checked={multiPayer}
              onChange={(e) => setMultiPayer(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-mint-600)]"
            />
            More than one person paid
          </label>
        </div>

        {multiPayer ? (
          <>
            <div className="divide-row">
              {participants.map((person) => (
                <div key={person.id} className="flex items-center gap-3 py-2">
                  <Avatar id={person.id} name={personName(person, self.id)} image={person.image} size={30} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {personName(person, self.id)}
                  </span>
                  <input
                    className="field w-32 text-right tabular-nums"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={payerAmounts[person.id] ?? ""}
                    onChange={(e) =>
                      setPayerAmounts((prev) => ({ ...prev, [person.id]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
            <RemainderBar
              label="paid"
              currentCents={paidTotal}
              totalCents={validTotal ? totalCents : 0}
              currency={currency}
            />
          </>
        ) : (
          <select className="field" value={payer} onChange={(e) => setPayer(e.target.value)}>
            {participants.map((person) => (
              <option key={person.id} value={person.id}>
                {personName(person, self.id)}
              </option>
            ))}
          </select>
        )}
      </section>

      {/* ---------------- Split method ---------------- */}
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="label mb-0">How to split</span>
          <span className="text-xs muted">{splitHint}</span>
        </div>

        <div className="mb-4 flex gap-1 rounded-xl bg-[var(--surface-raised)] p-1">
          {SPLIT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              title={tab.hint}
              onClick={() => setSplitMethod(tab.id)}
              className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition-colors ${
                splitMethod === tab.id
                  ? "bg-[var(--surface-card)] text-[var(--brand)] shadow-sm"
                  : "muted hover:text-[var(--text-strong)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="divide-row">
          {participants.map((person) => {
            const owed = preview?.owed.get(person.id);
            return (
              <div key={person.id} className="flex items-center gap-3 py-2.5">
                <Avatar id={person.id} name={personName(person, self.id)} image={person.image} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{personName(person, self.id)}</p>
                  {owed !== undefined && (
                    <p className="text-xs muted">owes {formatMoney(owed, currency)}</p>
                  )}
                </div>

                {splitMethod !== "EQUAL" && (
                  <div className="flex items-center gap-1">
                    {splitMethod === "ADJUSTMENT" && <span className="text-sm muted">+</span>}
                    <input
                      className="field w-28 text-right tabular-nums"
                      inputMode="decimal"
                      placeholder={splitMethod === "SHARES" ? "1" : "0"}
                      value={values[person.id] ?? ""}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [person.id]: e.target.value }))
                      }
                    />
                    {splitMethod === "PERCENT" && <span className="text-sm muted">%</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {participants.length === 0 && (
          <p className="py-3 text-sm muted">Pick at least one person above.</p>
        )}

        {preview?.error && (
          <p className="mt-3 rounded-xl bg-[var(--color-coral-50)] px-3 py-2 text-sm text-[var(--color-coral-700)] dark:bg-[#3a1d15] dark:text-[var(--color-coral-300)]">
            {preview.error}
          </p>
        )}

        {splitMethod === "EQUAL" && validTotal && participants.length > 0 && (
          <p className="mt-3 text-sm muted">
            {formatMoney(Math.floor(totalCents / participants.length), currency)} each
            {totalCents % participants.length !== 0 && " (the odd cents go to the first names)"}
          </p>
        )}
      </section>

      {/* ---------------- More options ---------------- */}
      <section className="card p-4">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="flex w-full items-center justify-between text-sm font-semibold"
        >
          More options
          <span className="muted">{showMore ? "−" : "+"}</span>
        </button>

        {showMore && (
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label className="label" htmlFor="notes">
                Notes
              </label>
              <textarea
                id="notes"
                className="field min-h-20"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything worth remembering about this bill"
                maxLength={2000}
              />
            </div>

            <div>
              <label className="label" htmlFor="recurrence">
                Repeat
              </label>
              <select
                id="recurrence"
                className="field"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as Recurrence)}
              >
                {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {recurrence !== "NONE" && (
                <p className="mt-1.5 text-xs muted">
                  A copy is created automatically each time it comes due.
                </p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="receipt">
                Receipt {initial.hasReceipt && <span className="muted">(one already attached)</span>}
              </label>
              <input
                id="receipt"
                type="file"
                name="receipt"
                accept="image/*,application/pdf"
                className="field file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface-raised)] file:px-3 file:py-1.5 file:text-sm"
              />
              <p className="mt-1.5 text-xs muted">Images or PDF, up to 3 MB.</p>
            </div>
          </div>
        )}
      </section>

      <FormMessage state={state} />

      {/* Pinned above the mobile tab bar so long splits stay one tap from
          saving; a normal footer once there's room for it. */}
      <div className="sticky bottom-24 z-10 flex gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)]/95 p-2 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <SubmitButton
          className="btn btn-primary flex-1 py-3"
          disabled={!validTotal || participants.length === 0 || Boolean(preview?.error)}
        >
          {submitLabel}
        </SubmitButton>
        <Link href={cancelHref} className="btn btn-secondary py-3">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function GroupPill({
  active,
  onClick,
  emoji,
  children,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-[var(--color-mint-400)] bg-[var(--brand-soft)] text-[var(--brand)]"
          : "border-[var(--surface-border)] muted hover:bg-[var(--surface-raised)]"
      }`}
    >
      <span>{emoji}</span>
      {children}
    </button>
  );
}

function CategoryPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = categoryById(value);

  return (
    <div className="relative">
      <span className="label">Category</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-[42px] w-[42px] place-items-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] text-xl"
        title={current.label}
        aria-label={`Category: ${current.label}`}
      >
        {current.icon}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 z-30 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-1 shadow-xl">
            {CATEGORIES.filter((c) => c.id !== "settlement").map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--surface-raised)] ${
                  c.id === value ? "text-[var(--brand)]" : ""
                }`}
              >
                <span>{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RemainderBar({
  label,
  currentCents,
  totalCents,
  currency,
}: {
  label: string;
  currentCents: number;
  totalCents: number;
  currency: string;
}) {
  const remaining = totalCents - currentCents;
  return (
    <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--surface-raised)] px-3 py-2 text-sm">
      <span className="muted">
        {formatMoney(currentCents, currency)} of {formatMoney(totalCents, currency)} {label}
      </span>
      <span className={remaining === 0 ? "positive font-semibold" : "negative font-semibold"}>
        {remaining === 0
          ? "balanced"
          : `${formatMoney(Math.abs(remaining), currency)} ${remaining > 0 ? "left" : "over"}`}
      </span>
    </div>
  );
}
