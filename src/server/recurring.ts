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
export async function materialiseRecurringExpenses(userId: string): Promise<number> {
  const now = new Date();

  const due = await prisma.expense.findMany({
    where: {
      deletedAt: null,
      recurrence: { not: "NONE" },
      nextOccurrence: { lte: now },
      shares: { some: { userId } },
    },
    include: { shares: true },
    take: 50,
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
