import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { NetLine, NoteList } from "@/components/NoteList";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { summariseNotes } from "@/lib/notes";
import { getFriendPhotos, getNicknames } from "@/lib/queries";
import { displayName, requireUser } from "@/lib/session";

export const metadata = { title: "Notes about a friend" };

/**
 * One person's page inside personal notes.
 *
 * It looks like their friend page on purpose — same shape, same running figure
 * at the top — except nothing here is a debt. The number is what has passed
 * between you off the books, and it stays out of every balance in the app.
 */
export default async function NotesPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [notes, nicknames, photos] = await Promise.all([
    prisma.personalNote.findMany({
      where: { userId: user.id, aboutUserId: id },
      include: {
        about: { select: { id: true, name: true, email: true, phone: true, image: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
    getNicknames(user.id),
    getFriendPhotos(user.id),
  ]);

  // Scoped to this owner's own notes, so an id that isn't theirs simply has
  // nothing to show rather than confirming the person exists.
  const person = notes[0]?.about;
  if (!person) notFound();

  const name = nicknames.get(person.id) ?? displayName(person);
  const face = photos.get(person.id) ?? person.image;
  const totals = summariseNotes(notes);

  return (
    <>
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-3">
            <Avatar id={person.id} name={name} image={face} size={44} />
            <span className="truncate">{name}</span>
          </span>
        }
        subtitle="Private notes only. None of this is counted in what you owe or are owed."
        back={{ href: "/notes", label: "Personal notes" }}
        action={
          <Link href={`/notes/new?about=${person.id}`} className="btn btn-primary">
            + Add a note
          </Link>
        }
      />

      <div className="flex max-w-2xl flex-col gap-5">
        <div className="card p-5">
          <p className="text-xs font-semibold tracking-wide muted uppercase">Net between you</p>
          <div className="mt-1">
            <NetLine totals={totals} size="lg" />
          </div>
        </div>

        {totals.map((row) => (
          <div
            key={row.currency}
            className={`card grid gap-px overflow-hidden bg-[var(--surface-border)] ${
              row.spent > 0 ? "sm:grid-cols-3" : "sm:grid-cols-2"
            }`}
          >
            <Tile label="You gave" cents={row.gave} currency={row.currency} />
            <Tile label="You received" cents={row.received} currency={row.currency} />
            {/* Money spent on nobody in particular is almost always nil here —
                only worth a tile when there actually is some. */}
            {row.spent > 0 && (
              <Tile label="Just spent" cents={row.spent} currency={row.currency} />
            )}
          </div>
        ))}

        {/* The name is in the header already; repeating it on every row is noise. */}
        <NoteList notes={notes} nameFor={() => null} />
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
