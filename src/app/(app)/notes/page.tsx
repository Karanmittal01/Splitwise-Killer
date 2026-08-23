import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { SubmitButton } from "@/components/form";
import { category } from "@/lib/categories";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getNicknames } from "@/lib/queries";
import { displayName, requireUser } from "@/lib/session";
import { deleteNoteAction } from "@/server/actions/notes";

export const metadata = { title: "Personal notes" };

const DIRECTION_LABELS: Record<string, string> = {
  GAVE: "You gave",
  RECEIVED: "You received",
  SPENT: "You spent",
};

const monthFormat = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { month: "short" });

export default async function NotesPage() {
  const user = await requireUser();

  const [notes, nicknames] = await Promise.all([
    prisma.personalNote.findMany({
      where: { userId: user.id },
      include: { about: { select: { id: true, name: true, email: true, phone: true, image: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
    getNicknames(user.id),
  ]);

  // Totals here are informational only — nothing on this page reaches the
  // balance engine.
  const totals = new Map<string, { gave: number; received: number; spent: number }>();
  for (const note of notes) {
    const bucket = totals.get(note.currency) ?? { gave: 0, received: 0, spent: 0 };
    if (note.direction === "GAVE") bucket.gave += note.amountCents;
    else if (note.direction === "RECEIVED") bucket.received += note.amountCents;
    else bucket.spent += note.amountCents;
    totals.set(note.currency, bucket);
  }

  const months: { key: string; label: string; items: typeof notes }[] = [];
  for (const note of notes) {
    const key = `${note.date.getFullYear()}-${note.date.getMonth()}`;
    const last = months[months.length - 1];
    if (last?.key === key) last.items.push(note);
    else months.push({ key, label: monthFormat.format(note.date), items: [note] });
  }

  return (
    <>
      <PageHeader
        title="Personal notes"
        subtitle="A private record that never touches anybody's balance."
        action={
          <Link href="/notes/new" className="btn btn-primary">
            + Add a note
          </Link>
        }
      />

      <div className="card mb-5 px-4 py-3">
        <p className="text-sm muted">
          Money that changed hands but nobody is settling — a gift, a round you insisted on, cash
          you handed someone. Only you can see these. They are never added to what you owe or are
          owed, and the person named is never told.
        </p>
      </div>

      {totals.size > 0 && (
        <div className="card mb-5 grid gap-px overflow-hidden bg-[var(--surface-border)] sm:grid-cols-3">
          {[...totals.entries()].flatMap(([currency, bucket]) => [
            <Tile key={`${currency}-gave`} label="Given away" cents={bucket.gave} currency={currency} />,
            <Tile key={`${currency}-recv`} label="Received" cents={bucket.received} currency={currency} />,
            <Tile key={`${currency}-spent`} label="Just spent" cents={bucket.spent} currency={currency} />,
          ])}
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState
          icon="🗒️"
          title="No notes yet"
          body="Keep a record of money that isn't coming back, without it skewing your balances."
          action={
            <Link href="/notes/new" className="btn btn-primary mt-2">
              Add a note
            </Link>
          }
        />
      ) : (
        <div className="flex max-w-2xl flex-col gap-5">
          {months.map((month) => (
            <div key={month.key}>
              <h3 className="mb-2 px-1 text-xs font-bold tracking-wider muted uppercase">
                {month.label}
              </h3>
              <div className="card divide-row">
                {month.items.map((note) => {
                  const cat = category(note.category);
                  const who = note.about
                    ? (nicknames.get(note.about.id) ?? displayName(note.about))
                    : null;
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
                              <Avatar
                                id={note.about.id}
                                name={who}
                                image={note.about.image}
                                size={14}
                              />
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
      )}
    </>
  );
}

function Tile({ label, cents, currency }: { label: string; cents: number; currency: string }) {
  return (
    <div className="bg-[var(--surface-card)] px-5 py-4">
      <p className="text-xs font-semibold tracking-wide muted uppercase">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(cents, currency)}</p>
    </div>
  );
}
