import { cache } from "react";
import { prisma } from "./db";
import {
  computeBalances,
  debtsForDisplay,
  simplifyDebts,
  summariseForUser,
  type CurrencyBalances,
  type Debt,
} from "./balances";

export type PersonRef = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  isPlaceholder: boolean;
};

const personSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  image: true,
  isPlaceholder: true,
} as const;

/**
 * The private labels this user has given people. Applied to `name` at the
 * query layer, so every screen shows the nickname without threading it
 * through the whole component tree.
 */
export const getNicknames = cache(async (userId: string): Promise<Map<string, string>> => {
  const rows = await prisma.friendship.findMany({
    where: { userId, NOT: { nickname: null } },
    select: { friendId: true, nickname: true },
  });
  return new Map(rows.map((row) => [row.friendId, row.nickname!]));
});

function renamed<T extends { id: string; name: string | null }>(
  people: T[],
  nicknames: Map<string, string>,
): T[] {
  if (nicknames.size === 0) return people;
  return people.map((person) =>
    nicknames.has(person.id) ? { ...person, name: nicknames.get(person.id)! } : person,
  );
}

const expenseForBalance = {
  id: true,
  groupId: true,
  currency: true,
  amountCents: true,
  isPayment: true,
  category: true,
  shares: { select: { userId: true, paidCents: true, owedCents: true } },
} as const;

/** Every live expense the user is part of, group and one-on-one alike. */
async function expensesInvolving(userId: string) {
  return prisma.expense.findMany({
    where: { deletedAt: null, shares: { some: { userId } } },
    select: expenseForBalance,
  });
}

/**
 * The user's net position against every other person, in every currency.
 *
 * Groups that have "simplify debts" switched on are collapsed first, so the
 * dashboard agrees with what each group screen shows.
 */
export async function userPairBalances(userId: string): Promise<
  Map<string, Map<string, number>> // currency -> otherUserId -> cents (positive = owed to user)
> {
  const [expenses, simplifiedGroups] = await Promise.all([
    expensesInvolving(userId),
    prisma.group.findMany({
      where: { simplifyDebts: true, members: { some: { userId } } },
      select: { id: true },
    }),
  ]);

  const simplifyIds = new Set(simplifiedGroups.map((g) => g.id));
  const plain = expenses.filter((e) => !e.groupId || !simplifyIds.has(e.groupId));
  const byGroup = new Map<string, typeof expenses>();
  for (const expense of expenses) {
    if (expense.groupId && simplifyIds.has(expense.groupId)) {
      const list = byGroup.get(expense.groupId) ?? [];
      list.push(expense);
      byGroup.set(expense.groupId, list);
    }
  }

  const result = new Map<string, Map<string, number>>();
  const add = (currency: string, other: string, cents: number) => {
    const bucket = result.get(currency) ?? new Map<string, number>();
    bucket.set(other, (bucket.get(other) ?? 0) + cents);
    result.set(currency, bucket);
  };
  const applyDebts = (currency: string, debts: Debt[]) => {
    for (const debt of debts) {
      if (debt.fromUserId === userId) add(currency, debt.toUserId, -debt.amountCents);
      else if (debt.toUserId === userId) add(currency, debt.fromUserId, debt.amountCents);
    }
  };

  for (const bucket of computeBalances(plain)) {
    applyDebts(bucket.currency, bucket.debts);
  }
  for (const groupExpenses of byGroup.values()) {
    for (const bucket of computeBalances(groupExpenses)) {
      applyDebts(bucket.currency, simplifyDebts(bucket.net));
    }
  }

  for (const [currency, bucket] of result) {
    for (const [other, value] of bucket) {
      if (value === 0) bucket.delete(other);
    }
    if (bucket.size === 0) result.delete(currency);
  }

  return result;
}

export type DashboardTotals = {
  currency: string;
  owedToYouCents: number;
  youOweCents: number;
  netCents: number;
}[];

export async function getDashboard(userId: string) {
  const pairs = await userPairBalances(userId);

  const peopleIds = new Set<string>();
  for (const bucket of pairs.values()) for (const id of bucket.keys()) peopleIds.add(id);

  const [rawPeople, groups, nicknames] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: [...peopleIds] } }, select: personSelect }),
    getUserGroupsWithBalances(userId),
    getNicknames(userId),
  ]);
  const peopleById = new Map(renamed(rawPeople, nicknames).map((p) => [p.id, p]));

  const totals: DashboardTotals = [];
  const perPerson: {
    person: PersonRef;
    amounts: { currency: string; netCents: number }[];
  }[] = [];

  const personAmounts = new Map<string, { currency: string; netCents: number }[]>();
  for (const [currency, bucket] of pairs) {
    let owedToYouCents = 0;
    let youOweCents = 0;
    for (const [otherId, value] of bucket) {
      if (value > 0) owedToYouCents += value;
      else youOweCents += -value;
      const list = personAmounts.get(otherId) ?? [];
      list.push({ currency, netCents: value });
      personAmounts.set(otherId, list);
    }
    totals.push({
      currency,
      owedToYouCents,
      youOweCents,
      netCents: owedToYouCents - youOweCents,
    });
  }

  for (const [personId, amounts] of personAmounts) {
    const person = peopleById.get(personId);
    if (!person) continue;
    perPerson.push({ person, amounts });
  }

  perPerson.sort((a, b) => {
    const aMax = Math.max(...a.amounts.map((x) => Math.abs(x.netCents)));
    const bMax = Math.max(...b.amounts.map((x) => Math.abs(x.netCents)));
    return bMax - aMax;
  });
  totals.sort((a, b) => Math.abs(b.netCents) - Math.abs(a.netCents));

  return { totals, perPerson, groups };
}

export type GroupCard = {
  id: string;
  name: string;
  emoji: string;
  type: string;
  archived: boolean;
  memberCount: number;
  yourBalances: { currency: string; netCents: number }[];
};

export async function getUserGroupsWithBalances(
  userId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<GroupCard[]> {
  const groups = await prisma.group.findMany({
    where: {
      members: { some: { userId } },
      ...(opts.includeArchived ? {} : { archived: false }),
    },
    select: {
      id: true,
      name: true,
      emoji: true,
      type: true,
      archived: true,
      simplifyDebts: true,
      _count: { select: { members: true } },
      expenses: {
        where: { deletedAt: null },
        select: { currency: true, shares: { select: { userId: true, paidCents: true, owedCents: true } } },
      },
    },
    orderBy: [{ archived: "asc" }, { updatedAt: "desc" }],
  });

  return groups.map((group) => {
    const balances = computeBalances(group.expenses);
    const summary = summariseForUser(balances, userId, group.simplifyDebts);
    return {
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      type: group.type,
      archived: group.archived,
      memberCount: group._count.members,
      yourBalances: summary
        .filter((s) => s.netCents !== 0)
        .map((s) => ({ currency: s.currency, netCents: s.netCents })),
    };
  });
}

export async function getGroupOrThrow(groupId: string, userId: string) {
  const nicknames = await getNicknames(userId);
  const group = await prisma.group.findFirst({
    where: { id: groupId, members: { some: { userId } } },
    include: {
      members: {
        include: { user: { select: personSelect } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!group) return null;

  return {
    ...group,
    members: group.members.map((membership) =>
      nicknames.has(membership.user.id)
        ? { ...membership, user: { ...membership.user, name: nicknames.get(membership.user.id)! } }
        : membership,
    ),
  };
}

/**
 * A group's balances, computed from *every* live expense in it — never from a
 * filtered list, so searching the ledger can't move the balance figures.
 */
export async function getGroupBalances(groupId: string, simplify: boolean) {
  const expenses = await prisma.expense.findMany({
    where: { groupId, deletedAt: null },
    select: expenseForBalance,
  });
  const balances = computeBalances(expenses);
  return {
    /** Every expense in the group, for totals. */
    expenses,
    balances,
    debts: balances.map((b) => ({ currency: b.currency, debts: debtsForDisplay(b, simplify) })),
    summaryFor: (userId: string) =>
      summariseForUser(balances, userId, simplify).filter((s) => s.netCents !== 0),
  };
}

export type ExpenseListItem = Awaited<ReturnType<typeof getGroupExpenses>>[number];

export async function getGroupExpenses(
  groupId: string,
  opts: { search?: string; category?: string; limit?: number } = {},
) {
  return prisma.expense.findMany({
    where: {
      groupId,
      deletedAt: null,
      ...(opts.search
        ? { description: { contains: opts.search, mode: "insensitive" as const } }
        : {}),
      ...(opts.category ? { category: opts.category } : {}),
    },
    include: {
      shares: { include: { user: { select: personSelect } } },
      createdBy: { select: personSelect },
      _count: { select: { comments: true } },
      receipt: { select: { id: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: opts.limit ?? 200,
  });
}

/** One-on-one history: every expense both people are part of. */
export async function getSharedExpenses(
  userId: string,
  friendId: string,
  opts: { limit?: number } = {},
) {
  return prisma.expense.findMany({
    where: {
      deletedAt: null,
      AND: [{ shares: { some: { userId } } }, { shares: { some: { userId: friendId } } }],
    },
    include: {
      shares: { include: { user: { select: personSelect } } },
      createdBy: { select: personSelect },
      group: { select: { id: true, name: true, emoji: true } },
      _count: { select: { comments: true } },
      receipt: { select: { id: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: opts.limit ?? 200,
  });
}

export async function getFriendsWithBalances(userId: string) {
  const [friendships, pairs, nicknames] = await Promise.all([
    prisma.friendship.findMany({
      where: { userId },
      include: { friend: { select: personSelect } },
    }),
    userPairBalances(userId),
    getNicknames(userId),
  ]);

  const balanceIds = new Set<string>();
  for (const bucket of pairs.values()) for (const id of bucket.keys()) balanceIds.add(id);

  const known = new Map(
    renamed(friendships.map((f) => f.friend), nicknames).map((friend) => [friend.id, friend]),
  );
  const missingIds = [...balanceIds].filter((id) => !known.has(id));
  if (missingIds.length > 0) {
    const extra = await prisma.user.findMany({
      where: { id: { in: missingIds } },
      select: personSelect,
    });
    for (const person of renamed(extra, nicknames)) known.set(person.id, person);
  }

  const rows = [...known.values()].map((person) => {
    const amounts: { currency: string; netCents: number }[] = [];
    for (const [currency, bucket] of pairs) {
      const value = bucket.get(person.id);
      if (value) amounts.push({ currency, netCents: value });
    }
    return { person, amounts };
  });

  rows.sort((a, b) => {
    const aMax = a.amounts.length ? Math.max(...a.amounts.map((x) => Math.abs(x.netCents))) : 0;
    const bMax = b.amounts.length ? Math.max(...b.amounts.map((x) => Math.abs(x.netCents))) : 0;
    if (aMax !== bMax) return bMax - aMax;
    return (a.person.name ?? "").localeCompare(b.person.name ?? "");
  });

  return rows;
}

export async function getExpenseForUser(expenseId: string, userId: string) {
  const expense = await prisma.expense.findFirst({
    where: {
      id: expenseId,
      deletedAt: null,
      OR: [
        { shares: { some: { userId } } },
        { createdById: userId },
        { group: { members: { some: { userId } } } },
      ],
    },
    include: {
      shares: { include: { user: { select: personSelect } } },
      createdBy: { select: personSelect },
      group: {
        select: {
          id: true,
          name: true,
          emoji: true,
          members: { select: { user: { select: personSelect } } },
        },
      },
      comments: {
        include: { user: { select: personSelect } },
        orderBy: { createdAt: "asc" },
      },
      receipt: { select: { id: true, mimeType: true, size: true } },
    },
  });
  return expense;
}

export async function getActivityFeed(userId: string, limit = 60, search?: string) {
  const q = search?.trim();
  return prisma.activity.findMany({
    where: {
      audience: { some: { userId } },
      // Search across the whole feed, not just what is currently on screen.
      ...(q
        ? {
            OR: [
              { summary: { contains: q, mode: "insensitive" as const } },
              { detail: { contains: q, mode: "insensitive" as const } },
              { actor: { name: { contains: q, mode: "insensitive" as const } } },
              { group: { name: { contains: q, mode: "insensitive" as const } } },
              { expense: { description: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    include: {
      actor: { select: personSelect },
      group: { select: { id: true, name: true, emoji: true } },
      expense: { select: { id: true, description: true, deletedAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: q ? 200 : limit,
  });
}

/** Everyone the user can pick when adding an expense: friends + co-members. */
export async function getConnections(userId: string): Promise<PersonRef[]> {
  const [friends, coMembers] = await Promise.all([
    prisma.friendship.findMany({
      where: { userId },
      select: { friend: { select: personSelect } },
    }),
    prisma.user.findMany({
      where: {
        id: { not: userId },
        memberships: { some: { group: { members: { some: { userId } } } } },
      },
      select: personSelect,
    }),
  ]);

  const nicknames = await getNicknames(userId);
  const byId = new Map<string, PersonRef>();
  for (const row of friends) byId.set(row.friend.id, row.friend);
  for (const person of coMembers) byId.set(person.id, person);
  return renamed([...byId.values()], nicknames).sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? ""),
  );
}
