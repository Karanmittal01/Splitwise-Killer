import { prisma } from "@/lib/db";
import { advance } from "@/lib/recurring";

/**
 * Create any recurring expenses that have come due.
 *
 * This runs whenever a member opens the app rather than on a cron, which keeps
 * the whole thing free to host — no scheduler, no background worker. It is
 * scoped to the caller's own groups and is a no-op (one indexed query) when
 * nothing is due.
 */
/**
 * Per-instance throttle. Recurring bills are weekly at their most frequent, so
 * checking once every 15 minutes per person is plenty — and it keeps a query
 * off the critical path of every single page view.
 */
const lastChecked = new Map<string, number>();
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export async function materialiseRecurringExpenses(userId: string): Promise<number> {
  const now = new Date();

  const previous = lastChecked.get(userId);
  if (previous && now.getTime() - previous < CHECK_INTERVAL_MS) return 0;
  lastChecked.set(userId, now.getTime());

  // Two steps on purpose: the common case is "nothing is due", and asking for
  // ids only keeps that case down to a single query. Pulling `shares` in one
  // go would make Prisma issue a second, pointless query every time.
  const dueIds = await prisma.expense.findMany({
    where: {
      deletedAt: null,
      recurrence: { not: "NONE" },
      nextOccurrence: { lte: now },
      shares: { some: { userId } },
    },
    select: { id: true },
    take: 50,
  });
  if (dueIds.length === 0) return 0;

  const due = await prisma.expense.findMany({
    where: { id: { in: dueIds.map((row) => row.id) } },
    include: { shares: true },
  });

  let created = 0;

  for (const template of due) {
    let cursor = template.nextOccurrence;
    let guard = 0;

    // Catch up on every missed occurrence (bounded, so a year-old template
    // can't spin here forever).
    while (cursor && cursor <= now && guard < 24) {
      const occurrenceDate = new Date(cursor);
      const alreadyThere = await prisma.expense.findFirst({
        where: {
          recurringOfId: template.id,
          date: occurrenceDate,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!alreadyThere) {
        await prisma.expense.create({
          data: {
            groupId: template.groupId,
            description: template.description,
            amountCents: template.amountCents,
            currency: template.currency,
            date: occurrenceDate,
            category: template.category,
            notes: template.notes,
            splitMethod: template.splitMethod,
            createdById: template.createdById,
            recurringOfId: template.id,
            recurrence: "NONE",
            shares: {
              create: template.shares.map((s) => ({
                userId: s.userId,
                paidCents: s.paidCents,
                owedCents: s.owedCents,
              })),
            },
          },
        });
        created += 1;
      }

      cursor = advance(cursor, template.recurrence);
      guard += 1;
    }

    await prisma.expense.update({
      where: { id: template.id },
      data: { nextOccurrence: cursor },
    });
  }

  return created;
}
