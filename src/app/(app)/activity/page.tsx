import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { prisma } from "@/lib/db";
import { getActivityFeed } from "@/lib/queries";
import { displayName, requireUser } from "@/lib/session";

export const metadata = { title: "Activity" };

const ICONS: Record<string, string> = {
  EXPENSE_ADDED: "🧾",
  EXPENSE_UPDATED: "✏️",
  EXPENSE_DELETED: "🗑️",
  PAYMENT_RECORDED: "💸",
  GROUP_CREATED: "👥",
  GROUP_MEMBER_ADDED: "🙋",
  GROUP_MEMBER_LEFT: "👋",
  COMMENT_ADDED: "💬",
  FRIEND_ADDED: "🤝",
};

function relative(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const table: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2592000, "week"],
    [31536000, "month"],
  ];
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (seconds < 60) return formatter.format(-seconds, "second");
  for (let i = 1; i < table.length; i += 1) {
    const [limit, unit] = table[i];
    if (seconds < limit) {
      const divisor = table[i - 1][0];
      return formatter.format(-Math.round(seconds / divisor), unit);
    }
  }
  return formatter.format(-Math.round(seconds / 31536000), "year");
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const feed = await getActivityFeed(user.id, 60, q);

  // Opening the page clears the unread badge (the highlight below still uses
  // the timestamp we read before this write).
  await prisma.user.update({
    where: { id: user.id },
    data: { activitySeenAt: new Date() },
  });

  return (
    <>
      <PageHeader title="Activity" subtitle="Everything that's happened across your groups." />

      <form className="mb-4 flex max-w-2xl flex-wrap items-center gap-2" action="/activity">
        <div className="min-w-44 flex-1">
          <input
            name="q"
            className="field"
            placeholder="Search all activity…"
            defaultValue={q ?? ""}
            aria-label="Search activity"
          />
        </div>
        <button type="submit" className="btn btn-secondary">
          Search
        </button>
        {q && (
          <Link href="/activity" className="btn btn-ghost">
            Clear
          </Link>
        )}
      </form>

      {feed.length === 0 ? (
        <EmptyState
          icon={q ? "🔍" : "🔔"}
          title={q ? "Nothing matches that" : "Nothing yet"}
          body={
            q
              ? "Try a different word, or clear the search to see everything."
              : "As soon as you or your friends add expenses, it all shows up here."
          }
        />
      ) : (
        <div className="card divide-row max-w-2xl">
          {feed.map((entry) => {
            const unread = entry.createdAt > user.activitySeenAt && entry.actorId !== user.id;
            const body = (
              <div className={`flex gap-3 px-4 py-3 ${unread ? "bg-[var(--brand-soft)]/50" : ""}`}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-raised)]">
                  {ICONS[entry.type] ?? "•"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <Avatar
                      id={entry.actor.id}
                      name={displayName(entry.actor)}
                      image={entry.actor.image}
                      size={18}
                    />{" "}
                    <span className="font-semibold">
                      {displayName(entry.actor, user.id, entry.actor.id)}
                    </span>{" "}
                    {entry.summary}
                    {entry.group && <span className="muted"> in {entry.group.name}</span>}
                  </p>
                  {entry.detail && <p className="text-sm muted">{entry.detail}</p>}
                  <p className="mt-0.5 text-xs muted">{relative(entry.createdAt)}</p>
                </div>
              </div>
            );

            return entry.expense && !entry.expense.deletedAt ? (
              <Link
                key={entry.id}
                href={`/expenses/${entry.expense.id}`}
                className="block transition-colors hover:bg-[var(--surface-raised)]"
              >
                {body}
              </Link>
            ) : (
              <div key={entry.id}>{body}</div>
            );
          })}
        </div>
      )}
    </>
  );
}
