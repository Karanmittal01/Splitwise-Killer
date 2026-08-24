import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { NetLine, NoteList } from "@/components/NoteList";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { groupNotesByPerson, summariseNotes } from "@/lib/notes";
import { getFriendPhotos, getNicknames } from "@/lib/queries";
import { displayName, requireUser } from "@/lib/session";

export const metadata = { title: "Personal notes" };

export default async function NotesPage() {
  const user = await requireUser();

  const [notes, nicknames, photos] = await Promise.all([
    prisma.personalNote.findMany({
      where: { userId: user.id },
      include: {
        about: { select: { id: true, name: true, email: true, phone: true, image: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
    getNicknames(user.id),
    getFriendPhotos(user.id),
  ]);

  // Everything on this page is informational. None of it reaches the balance
  // engine, and the people named are never told.
  const totals = summariseNotes(notes);

  const people = groupNotesByPerson(notes)
    .map((group) => {
      const about = group.notes[0].about!;
      return {
        ...group,
        person: about,
        name: nicknames.get(about.id) ?? displayName(about),
        // A picture you uploaded for them wins over their own, as everywhere.
        face: photos.get(about.id) ?? about.image,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const names = new Map(people.map((entry) => [entry.aboutUserId, entry.name]));
  const nameFor = (id: string) => names.get(id) ?? null;

  const rows = notes.map((note) =>
    note.about && photos.has(note.about.id)
      ? { ...note, about: { ...note.about, image: photos.get(note.about.id)! } }
      : note,
  );

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

      <div className="flex max-w-2xl flex-col gap-5">
        <div className="card px-4 py-3">
          <p className="text-sm muted">
            Money that changed hands but nobody is settling — a gift, a round you insisted on, cash
            you handed someone. Only you can see these. They are never added to what you owe or are
            owed, and the person named is never told.
          </p>
        </div>

        {totals.map((row) => (
          <div
            key={row.currency}
            className="card grid gap-px overflow-hidden bg-[var(--surface-border)] sm:grid-cols-3"
          >
            <Tile label="Given away" cents={row.gave} currency={row.currency} />
            <Tile label="Received" cents={row.received} currency={row.currency} />
            <Tile label="Just spent" cents={row.spent} currency={row.currency} />
          </div>
        ))}

        {people.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-xs font-bold tracking-wider muted uppercase">
              People ({people.length})
            </h2>
            <div className="card divide-row">
              {people.map((entry) => (
                <Link
                  key={entry.aboutUserId}
                  href={`/notes/person/${entry.aboutUserId}`}
                  className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-[var(--surface-raised)] sm:px-4"
                >
                  <Avatar
                    id={entry.person.id}
                    name={entry.name}
                    image={entry.face}
                    size={40}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{entry.name}</span>
                    <span className="block truncate text-xs muted">
                      {entry.notes.length} {entry.notes.length === 1 ? "note" : "notes"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <NetLine totals={entry.totals} />
                  </span>
                </Link>
              ))}
            </div>
          </section>
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
          <section>
            <h2 className="mb-2 px-1 text-xs font-bold tracking-wider muted uppercase">
              Everything, newest first
            </h2>
            <NoteList notes={rows} nameFor={nameFor} />
          </section>
        )}
      </div>
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
