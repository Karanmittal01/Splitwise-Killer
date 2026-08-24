import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { DIRECTION_LABELS } from "@/components/NoteList";
import { SubmitButton } from "@/components/form";
import { category } from "@/lib/categories";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { getFriendPhotos, getNicknames } from "@/lib/queries";
import { displayName, requireUser } from "@/lib/session";
import { deleteNoteAction } from "@/server/actions/notes";

export const metadata = { title: "Note" };

const fullDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * One note in full, and the only place it can be deleted.
 *
 * Deleting used to be a button on every row of the list, which is a bad place
 * for it: it sits under your thumb while you're only scrolling, and there is no
 * undo. Getting here takes a deliberate tap, and the confirm is the second.
 */
export default async function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const note = await prisma.personalNote.findFirst({
    // Scoped to the owner: somebody else's note is simply not found.
    where: { id, userId: user.id },
    include: {
      about: { select: { id: true, name: true, email: true, phone: true, image: true } },
    },
  });
  if (!note) notFound();

  const [nicknames, photos] = await Promise.all([
    getNicknames(user.id),
    getFriendPhotos(user.id),
  ]);

  const cat = category(note.category);
  const person = note.about;
  const personName = person ? (nicknames.get(person.id) ?? displayName(person)) : null;
  const personFace = person ? (photos.get(person.id) ?? person.image) : null;
  const backHref = person ? `/notes/person/${person.id}` : "/notes";

  return (
    <>
      <PageHeader
        title="Note"
        subtitle="Private to you, and never counted in any balance."
        back={{
          href: backHref,
          label: person && personName ? personName : "Personal notes",
        }}
      />

      <div className="flex max-w-xl flex-col gap-5">
        <section className="card p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--surface-raised)] text-2xl">
              {cat.icon}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">{note.description}</h2>
              <p className="text-sm muted">{cat.label}</p>
            </div>
          </div>

          <p className="mt-4 text-3xl font-bold tabular-nums">
            {formatMoney(note.amountCents, note.currency)}
          </p>
          <p className="text-sm muted">{DIRECTION_LABELS[note.direction]}</p>

          <dl className="mt-5 flex flex-col gap-3 border-t border-[var(--surface-border)] pt-4 text-sm">
            <Row label="Date">{fullDate.format(note.date)}</Row>

            {person && personName && (
              <Row label="Who">
                <Link
                  href={`/notes/person/${person.id}`}
                  className="inline-flex items-center gap-2 hover:underline"
                >
                  <Avatar id={person.id} name={personName} image={personFace} size={22} />
                  {personName}
                </Link>
              </Row>
            )}

            {note.notes && (
              <Row label="Notes">
                <span className="whitespace-pre-wrap">{note.notes}</span>
              </Row>
            )}
          </dl>
        </section>

        <section className="card p-4">
          <h2 className="mb-1 font-semibold">Delete this note</h2>
          <p className="mb-3 text-sm muted">
            It disappears for good — there is no undo, and nothing else in the app changes.
          </p>
          <ActionForm action={deleteNoteAction} confirm={`Delete "${note.description}"?`}>
            <input type="hidden" name="noteId" value={note.id} />
            <input type="hidden" name="returnTo" value={backHref} />
            <SubmitButton className="btn btn-danger" pendingLabel="Deleting…">
              Delete note
            </SubmitButton>
          </ActionForm>
        </section>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  );
}
