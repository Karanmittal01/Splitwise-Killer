import { PageHeader } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { CurrencySelect } from "@/components/CurrencySelect";
import { SubmitButton } from "@/components/form";
import { CATEGORIES } from "@/lib/categories";
import { getConnections } from "@/lib/queries";
import { displayName, requireUser } from "@/lib/session";
import { createNoteAction } from "@/server/actions/notes";

export const metadata = { title: "Add a note" };

const DIRECTIONS = [
  { id: "GAVE", label: "I gave money", hint: "Not expecting it back" },
  { id: "RECEIVED", label: "I received money", hint: "Not paying it back" },
  { id: "SPENT", label: "I just spent it", hint: "Only a record" },
];

export default async function NewNotePage() {
  const user = await requireUser();
  const connections = await getConnections(user.id);

  return (
    <>
      <PageHeader
        title="Add a note"
        subtitle="Private to you, and never counted in any balance."
        back={{ href: "/notes", label: "Personal notes" }}
      />

      <div className="max-w-xl">
        <ActionForm action={createNoteAction} className="flex flex-col gap-5" messagePosition="above">
          <section className="card flex flex-col gap-4 p-4">
            <div>
              <span className="label">What happened</span>
              <div className="flex flex-col gap-2">
                {DIRECTIONS.map((option, index) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--surface-border)] p-3 has-checked:border-[var(--color-mint-400)] has-checked:bg-[var(--brand-soft)]"
                  >
                    <input
                      type="radio"
                      name="direction"
                      value={option.id}
                      defaultChecked={index === 0}
                      className="mt-0.5 h-4 w-4 accent-[var(--color-mint-600)]"
                    />
                    <span className="text-sm">
                      <span className="font-semibold">{option.label}</span>
                      <span className="block muted">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="description">
                Description
              </label>
              <input
                id="description"
                name="description"
                className="field"
                placeholder="Lent Dad cash for the plumber"
                maxLength={120}
                required
              />
            </div>

            <div className="grid grid-cols-[4.25rem_1fr] gap-3 sm:grid-cols-[4.25rem_1fr_10.5rem]">
              <CurrencySelect name="currency" defaultValue={user.defaultCurrency} />
              <div className="min-w-0">
                <label className="label" htmlFor="amount">
                  Amount
                </label>
                <input
                  id="amount"
                  name="amount"
                  className="field text-2xl font-semibold tabular-nums"
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
                  name="date"
                  type="date"
                  className="field"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="aboutUserId">
                  Who it involved (optional)
                </label>
                <select id="aboutUserId" name="aboutUserId" className="field" defaultValue="">
                  <option value="">Nobody in particular</option>
                  {connections.map((person) => (
                    <option key={person.id} value={person.id}>
                      {displayName(person)}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs muted">They are never told about this.</p>
              </div>

              <div>
                <label className="label" htmlFor="category">
                  Category
                </label>
                <select id="category" name="category" className="field" defaultValue="general">
                  {CATEGORIES.filter((c) => c.id !== "settlement").map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="notes">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                className="field min-h-20"
                placeholder="Anything worth remembering"
                maxLength={2000}
              />
            </div>
          </section>

          <div className="flex gap-3">
            <SubmitButton className="btn btn-primary flex-1 py-3" pendingLabel="Saving…">
              Save note
            </SubmitButton>
            <a href="/notes" className="btn btn-secondary py-3">
              Cancel
            </a>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
