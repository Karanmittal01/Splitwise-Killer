import { ActionForm } from "./ActionForm";
import { Avatar } from "./Avatar";
import { SubmitButton } from "./form";
import { category } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import type { NoteTotals } from "@/lib/notes";
import { deleteNoteAction } from "@/server/actions/notes";

export const DIRECTION_LABELS: Record<string, string> = {
  GAVE: "You gave",
  RECEIVED: "You received",
  SPENT: "You spent",
};

const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { month: "short" });

export type NoteRow = {
  id: string;
  direction: string;
  description: string;
  amountCents: number;
  currency: string;
  date: Date;
  category: string;
  about: { id: string; image: string | null } | null;
};

/**
 * The month-by-month list of notes, shared by the main page and each person's
 * own page. `nameFor` resolves whoever a note names — the person pages pass one
 * that returns null, since repeating the same name on every row of their own
 * page is just noise.
 */
export function NoteList({
  notes,
  nameFor,
}: {
  notes: NoteRow[];
  nameFor: (id: string) => string | null;
}) {
  const months: { key: string; label: string; items: NoteRow[] }[] = [];
  for (const note of notes) {
    const key = `${note.date.getFullYear()}-${note.date.getMonth()}`;
    const last = months[months.length - 1];
    if (last?.key === key) last.items.push(note);
    else months.push({ key, label: monthFormat.format(note.date), items: [note] });
  }

  return (
    <div className="flex flex-col gap-5">
      {months.map((month) => (
        <div key={month.key}>
          <h3 className="mb-2 px-1 text-xs font-bold tracking-wider muted uppercase">
            {month.label}
          </h3>
          <div className="card divide-row">
            {month.items.map((note) => {
              const cat = category(note.category);
              const who = note.about ? nameFor(note.about.id) : null;
              return (
                <div key={note.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                  <div className="w-9 shrink-0 text-center">
                    <p className="text-[11px] font-semibold muted uppercase">
                      {dayFormat.format(note.date)}
                    </p>
                    <p className="text-lg leading-tight font-bold">{note.date.getDate()}</p>
                  </div>

                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-raised)] text-lg">
                    {cat.icon}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{note.description}</p>
                    <p className="flex items-center gap-1.5 truncate text-xs muted">
                      {DIRECTION_LABELS[note.direction]}
                      {note.about && who && (
                        <>
                          ·
                          <Avatar id={note.about.id} name={who} image={note.about.image} size={14} />
                          {who}
                        </>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="tabular-nums font-semibold">
                      {formatMoney(note.amountCents, note.currency)}
                    </p>
                    <ActionForm
                      action={deleteNoteAction}
                      confirm="Delete this note?"
                      messagePosition="none"
                    >
                      <input type="hidden" name="noteId" value={note.id} />
                      <SubmitButton className="btn btn-ghost px-1 text-[11px]" pendingLabel="…">
                        Delete
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The net figure for one person, in words.
 *
 * Says "more than" rather than "owes", because that is the whole point of this
 * page: money that moved but that nobody is settling. Calling it a debt here
 * would undo the distinction the feature exists to make.
 */
export function NetLine({ totals, size = "sm" }: { totals: NoteTotals[]; size?: "sm" | "lg" }) {
  const settled = totals.filter((row) => row.gave !== 0 || row.received !== 0);

  if (settled.length === 0) {
    return <span className="muted">Nothing back and forth</span>;
  }

  return (
    <span className={size === "lg" ? "flex flex-col gap-1" : "flex flex-col gap-0.5"}>
      {settled.map((row) => {
        const even = row.net === 0;
        const outward = row.net > 0;
        return (
          <span key={row.currency} className="flex flex-col">
            <span
              className={`tabular-nums font-semibold ${size === "lg" ? "text-2xl" : ""} ${
                even ? "" : outward ? "text-[var(--brand)]" : "text-[var(--color-coral-600)]"
              }`}
            >
              {even ? formatMoney(0, row.currency) : formatMoney(Math.abs(row.net), row.currency)}
            </span>
            <span className={`muted ${size === "lg" ? "text-sm" : "text-xs"}`}>
              {even ? "even between you" : outward ? "you gave more" : "you received more"}
            </span>
          </span>
        );
      })}
    </span>
  );
}
