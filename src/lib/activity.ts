import { prisma } from "./db";
import type { ActivityType } from "@/generated/prisma/enums";

/**
 * Activity is fanned out to an audience table so each person's feed is a
 * single indexed read, exactly like the Splitwise activity tab.
 */
export async function recordActivity(params: {
  type: ActivityType;
  actorId: string;
  summary: string;
  detail?: string | null;
  groupId?: string | null;
  expenseId?: string | null;
  audience: string[];
}): Promise<void> {
  const audience = [...new Set(params.audience)].filter(Boolean);
  if (audience.length === 0) return;

  await prisma.activity.create({
    data: {
      type: params.type,
      actorId: params.actorId,
      summary: params.summary,
      detail: params.detail ?? null,
      groupId: params.groupId ?? null,
      expenseId: params.expenseId ?? null,
      audience: { create: audience.map((userId) => ({ userId })) },
    },
  });
}

export async function unreadActivityCount(userId: string, since: Date): Promise<number> {
  return prisma.activity.count({
    where: {
      audience: { some: { userId } },
      createdAt: { gt: since },
      NOT: { actorId: userId },
    },
  });
}
