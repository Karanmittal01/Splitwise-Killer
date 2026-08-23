import { PageHeader } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/form";
import { CURRENCIES } from "@/lib/currencies";
import { requireUser } from "@/lib/session";
import { createGroupAction } from "@/server/actions/groups";

export const metadata = { title: "New group" };

const TYPES = [
  { id: "TRIP", label: "Trip", emoji: "✈️" },
  { id: "HOME", label: "Home", emoji: "🏠" },
  { id: "COUPLE", label: "Couple", emoji: "❤️" },
  { id: "FRIENDS", label: "Friends", emoji: "🍻" },
  { id: "OTHER", label: "Other", emoji: "🧾" },
];

export default async function NewGroupPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader
        title="Start a new group"
        subtitle="A shared space for a trip, a flat, or anything else you split."
        back={{ href: "/groups", label: "Groups" }}
      />

      <div className="max-w-xl">
        <ActionForm action={createGroupAction} className="flex flex-col gap-5" messagePosition="above">
          <section className="card flex flex-col gap-4 p-4">
            <div className="flex gap-3">
              <div className="w-20 shrink-0">
                <label className="label" htmlFor="emoji">
                  Icon
                </label>
                <input
                  id="emoji"
                  name="emoji"
                  className="field text-center text-xl"
                  defaultValue="🧾"
                  maxLength={8}
                />
              </div>
              <div className="min-w-0 flex-1">
                <label className="label" htmlFor="name">
                  Group name
                </label>
                <input
                  id="name"
                  name="name"
                  className="field"
                  placeholder="Goa 2026"
                  maxLength={80}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <span className="label">Type</span>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((type, index) => (
                  <label
                    key={type.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-sm font-medium has-checked:border-[var(--color-mint-400)] has-checked:bg-[var(--brand-soft)] has-checked:text-[var(--brand)]"
                  >
                    <input
                      type="radio"
                      name="type"
                      value={type.id}
                      defaultChecked={index === 0}
                      className="sr-only"
                    />
                    <span>{type.emoji}</span>
                    {type.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="currency">
                Default currency
              </label>
              <select
                id="currency"
                name="currency"
                className="field"
                defaultValue={user.defaultCurrency}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="card p-4">
            <label className="label" htmlFor="members">
              Invite people
            </label>
            <textarea
              id="members"
              name="members"
              className="field min-h-24"
              placeholder={"riya@gmail.com\n+91 98765 43210\nArjun <arjun@work.com>"}
            />
            <p className="mt-2 text-xs muted">
              One email or mobile number per line. They don&apos;t need an account — you can start
              adding expenses right away and they&apos;ll see their share when they sign in.
            </p>
          </section>

          <div className="flex gap-3">
            <SubmitButton className="btn btn-primary flex-1 py-3" pendingLabel="Creating…">
              Create group
            </SubmitButton>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
