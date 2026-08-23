import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { unreadActivityCount } from "@/lib/activity";
import { materialiseRecurringExpenses } from "@/server/recurring";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Recurring expenses are created on demand instead of by a cron job.
  await materialiseRecurringExpenses(user.id);

  const [groups, unread] = await Promise.all([
    prisma.group.findMany({
      where: { members: { some: { userId: user.id } }, archived: false },
      select: { id: true, name: true, emoji: true },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    unreadActivityCount(user.id, user.activitySeenAt),
  ]);

  return (
    <AppShell user={user} groups={groups} unread={unread}>
      {children}
    </AppShell>
  );
}
