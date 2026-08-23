import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { Money } from "@/components/Money";
import { SubmitButton } from "@/components/form";
import { getFriendsWithBalances } from "@/lib/queries";
import { displayName, requireUser } from "@/lib/session";
import { ImportContacts } from "@/components/ImportContacts";
import { addFriendAction } from "@/server/actions/friends";

export const metadata = { title: "Friends" };

export default async function FriendsPage() {
  const user = await requireUser();
  const friends = await getFriendsWithBalances(user.id);

  return (
    <>
      <PageHeader title="Friends" subtitle="Everyone you split with, and where you stand." />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {friends.length === 0 ? (
            <EmptyState
              icon="🙋"
              title="No friends yet"
              body="Add someone by email or mobile number. They'll be able to see their share as soon as they sign in with Google."
            />
          ) : (
            <div className="card divide-row">
              {friends.map(({ person, amounts }) => (
                <Link
                  key={person.id}
                  href={`/friends/${person.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-raised)]"
                >
                  <Avatar id={person.id} name={displayName(person)} image={person.image} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{displayName(person)}</p>
                    <p className="truncate text-xs muted">
                      {person.email ?? person.phone ?? ""}
                      {person.isPlaceholder && " · invited"}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    {amounts.length === 0 ? (
                      <span className="muted">settled up</span>
                    ) : (
                      amounts.map((amount) => (
                        <div key={amount.currency}>
                          <span className="block text-[11px] muted">
                            {amount.netCents > 0 ? "owes you" : "you owe"}
                          </span>
                          <Money cents={amount.netCents} currency={amount.currency} />
                        </div>
                      ))
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <ActionForm action={addFriendAction} className="card p-4">
            <h2 className="mb-3 font-semibold">Add a friend</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label" htmlFor="name">
                  Nickname (optional)
                </label>
                <input id="name" name="name" className="field" placeholder="Riya (only you see this)" maxLength={60} />
              </div>
              <div>
                <label className="label" htmlFor="handle">
                  Email or mobile number
                </label>
                <input
                  id="handle"
                  name="handle"
                  className="field"
                  placeholder="riya@gmail.com"
                  required
                />
              </div>
              <SubmitButton className="btn btn-primary w-full" pendingLabel="Adding…">
                Add friend
              </SubmitButton>
            </div>
            <p className="mt-3 text-xs muted">
              No account needed on their side yet — they sign in with Google when they&apos;re
              ready, and their share is waiting.
            </p>
          </ActionForm>

          <ImportContacts />
        </aside>
      </div>
    </>
  );
}
