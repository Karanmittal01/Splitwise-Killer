import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Money } from "@/components/Money";
import { getFriendsWithBalances } from "@/lib/queries";
import { displayName, requireUser } from "@/lib/session";

export const metadata = { title: "Friends" };

/**
 * The friends list, and nothing else.
 *
 * This is the screen that gets opened most, so it holds one thing: who you
 * split with and where you stand with each of them. Adding people — by hand or
 * from your contacts — lives on its own page behind the button in the header,
 * rather than as a permanent form taking up a third of the width.
 */
export default async function FriendsPage() {
  const user = await requireUser();
  const friends = await getFriendsWithBalances(user.id);

  return (
    <>
      <PageHeader
        title="Friends"
        subtitle={
          friends.length === 0
            ? "Everyone you split with, and where you stand."
            : `${friends.length} ${friends.length === 1 ? "person" : "people"}, sorted by what's outstanding.`
        }
        action={
          <Link href="/friends/new" className="btn btn-primary">
            + Add a friend
          </Link>
        }
      />

      <div className="max-w-2xl">
        {friends.length === 0 ? (
          <EmptyState
            icon="🙋"
            title="No friends yet"
            body="Add someone by email or mobile number, or pull them in from your contacts. They'll see their share as soon as they sign in."
            action={
              <Link href="/friends/new" className="btn btn-primary mt-2">
                Add a friend
              </Link>
            }
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
                <div className="shrink-0 text-right text-sm">
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
    </>
  );
}
