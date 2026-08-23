import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { Money } from "@/components/Money";
import { getUserGroupsWithBalances } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Groups" };

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const user = await requireUser();
  const showArchived = (await searchParams).archived === "1";
  const groups = await getUserGroupsWithBalances(user.id, { includeArchived: showArchived });

  const active = groups.filter((g) => !g.archived);
  const archived = groups.filter((g) => g.archived);

  return (
    <>
      <PageHeader
        title="Groups"
        subtitle="Every trip, flat and dinner club in one place."
        action={
          <Link href="/groups/new" className="btn btn-primary">
            + New group
          </Link>
        }
      />

      {active.length === 0 && archived.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No groups yet"
          body="Create one for your next trip or your flat, invite people by email or mobile, and start splitting."
          action={
            <Link href="/groups/new" className="btn btn-primary mt-2">
              Create a group
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {active.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}

      {showArchived && archived.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-lg font-semibold">Archived</h2>
          <div className="grid gap-3 opacity-70 sm:grid-cols-2">
            {archived.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        </>
      )}

      <div className="mt-6">
        <Link
          href={showArchived ? "/groups" : "/groups?archived=1"}
          className="text-sm text-[var(--brand)] hover:underline"
        >
          {showArchived ? "Hide archived groups" : "Show archived groups"}
        </Link>
      </div>
    </>
  );
}

function GroupCard({
  group,
}: {
  group: {
    id: string;
    name: string;
    emoji: string;
    memberCount: number;
    yourBalances: { currency: string; netCents: number }[];
  };
}) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className="card flex items-center gap-3 p-4 transition-colors hover:bg-[var(--surface-raised)]"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-2xl">
        {group.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{group.name}</p>
        <p className="text-xs muted">
          {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
        </p>
      </div>
      <div className="text-right text-sm">
        {group.yourBalances.length === 0 ? (
          <span className="muted">settled up</span>
        ) : (
          group.yourBalances.map((balance) => (
            <div key={balance.currency}>
              <span className="block text-[11px] muted">
                {balance.netCents > 0 ? "you are owed" : "you owe"}
              </span>
              <Money cents={balance.netCents} currency={balance.currency} />
            </div>
          ))
        )}
      </div>
    </Link>
  );
}
