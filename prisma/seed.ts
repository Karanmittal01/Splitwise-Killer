/**
 * Demo data for kicking the tyres.
 *
 *   npm run db:seed
 *
 * Creates four people, two groups and a realistic spread of expenses. Sign in
 * as demo.alex@example.com with the development sign-in shortcut to explore.
 * Running it twice replaces the previous demo data and leaves other rows alone.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { splitEvenly } from "../src/lib/money";

process.loadEnvFile?.(".env");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEMO = {
  alex: { email: "demo.alex@example.com", name: "Alex Fernandes" },
  sam: { email: "demo.sam@example.com", name: "Sam Iyer" },
  riya: { email: "demo.riya@example.com", name: "Riya Kapoor" },
  jordan: { email: "demo.jordan@example.com", name: "Jordan Lee" },
};

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(12, 0, 0, 0);
  return date;
}

async function main() {
  const emails = Object.values(DEMO).map((d) => d.email);

  // Clear anything left from a previous seed.
  const existing = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  if (existing.length > 0) {
    const ids = existing.map((u) => u.id);
    await prisma.group.deleteMany({ where: { createdById: { in: ids } } });
    await prisma.expense.deleteMany({ where: { createdById: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  const [alex, sam, riya, jordan] = await Promise.all(
    Object.values(DEMO).map((person, index) =>
      prisma.user.create({
        data: {
          email: person.email,
          name: person.name,
          isPlaceholder: index === 3, // Jordan was invited but never signed in.
          defaultCurrency: "INR",
          emailVerified: index === 3 ? null : new Date(),
        },
      }),
    ),
  );

  const everyone = [alex, sam, riya, jordan];

  // Friendships in both directions.
  for (const a of everyone) {
    for (const b of everyone) {
      if (a.id === b.id) continue;
      await prisma.friendship.upsert({
        where: { userId_friendId: { userId: a.id, friendId: b.id } },
        create: { userId: a.id, friendId: b.id },
        update: {},
      });
    }
  }

  const goa = await prisma.group.create({
    data: {
      name: "Goa 2026",
      type: "TRIP",
      emoji: "🏖️",
      currency: "INR",
      createdById: alex.id,
      members: {
        create: everyone.map((user, index) => ({ userId: user.id, isAdmin: index === 0 })),
      },
    },
  });

  const flat = await prisma.group.create({
    data: {
      name: "Indiranagar flat",
      type: "HOME",
      emoji: "🏠",
      currency: "INR",
      simplifyDebts: true,
      createdById: sam.id,
      members: { create: [alex, sam, riya].map((u) => ({ userId: u.id })) },
    },
  });

  type Seeded = {
    group: string;
    description: string;
    amount: number;
    category: string;
    currency?: string;
    payer: string;
    among: string[];
    date: Date;
    notes?: string;
    recurrence?: "MONTHLY";
  };

  const expenses: Seeded[] = [
    {
      group: goa.id,
      description: "Beach villa, 3 nights",
      amount: 4800000,
      category: "hotel",
      payer: alex.id,
      among: everyone.map((u) => u.id),
      date: daysAgo(21),
      notes: "Two twin rooms and a sea-facing balcony.",
    },
    {
      group: goa.id,
      description: "Flights to Dabolim",
      amount: 3200000,
      category: "flight",
      payer: riya.id,
      among: everyone.map((u) => u.id),
      date: daysAgo(25),
    },
    {
      group: goa.id,
      description: "Scooter rentals",
      amount: 480000,
      category: "car",
      payer: sam.id,
      among: everyone.map((u) => u.id),
      date: daysAgo(20),
    },
    {
      group: goa.id,
      description: "Dinner at Thalassa",
      amount: 862500,
      category: "dining",
      payer: alex.id,
      among: everyone.map((u) => u.id),
      date: daysAgo(19),
    },
    {
      group: goa.id,
      description: "Sunset cruise",
      amount: 600000,
      category: "sports",
      payer: jordan.id,
      among: everyone.map((u) => u.id),
      date: daysAgo(18),
    },
    {
      group: flat.id,
      description: "October rent",
      amount: 6000000,
      category: "rent",
      payer: sam.id,
      among: [alex.id, sam.id, riya.id],
      date: daysAgo(12),
      recurrence: "MONTHLY",
    },
    {
      group: flat.id,
      description: "Electricity bill",
      amount: 348000,
      category: "electricity",
      payer: alex.id,
      among: [alex.id, sam.id, riya.id],
      date: daysAgo(9),
    },
    {
      group: flat.id,
      description: "Weekly groceries",
      amount: 421500,
      category: "groceries",
      payer: riya.id,
      among: [alex.id, sam.id, riya.id],
      date: daysAgo(5),
    },
    {
      group: flat.id,
      description: "Broadband",
      amount: 129900,
      category: "internet",
      payer: sam.id,
      among: [alex.id, sam.id, riya.id],
      date: daysAgo(3),
      recurrence: "MONTHLY",
    },
  ];

  for (const seed of expenses) {
    const owed = splitEvenly(seed.amount, seed.among.length);
    const shares = seed.among.map((userId, index) => ({
      userId,
      paidCents: userId === seed.payer ? seed.amount : 0,
      owedCents: owed[index],
    }));
    if (!seed.among.includes(seed.payer)) {
      shares.push({ userId: seed.payer, paidCents: seed.amount, owedCents: 0 });
    }

    const expense = await prisma.expense.create({
      data: {
        groupId: seed.group,
        description: seed.description,
        amountCents: seed.amount,
        currency: seed.currency ?? "INR",
        date: seed.date,
        category: seed.category,
        notes: seed.notes,
        createdById: seed.payer,
        recurrence: seed.recurrence ?? "NONE",
        nextOccurrence: seed.recurrence ? daysAgo(-18) : null,
        shares: { create: shares },
      },
    });

    await prisma.activity.create({
      data: {
        type: "EXPENSE_ADDED",
        actorId: seed.payer,
        groupId: seed.group,
        expenseId: expense.id,
        summary: `added "${seed.description}"`,
        detail: `₹${(seed.amount / 100).toLocaleString("en-IN")}`,
        createdAt: seed.date,
        audience: { create: shares.map((s) => ({ userId: s.userId })) },
      },
    });
  }

  // A one-on-one expense outside any group.
  await prisma.expense.create({
    data: {
      description: "Concert tickets",
      amountCents: 700000,
      currency: "INR",
      date: daysAgo(7),
      category: "music",
      createdById: alex.id,
      shares: {
        create: [
          { userId: alex.id, paidCents: 700000, owedCents: 350000 },
          { userId: sam.id, paidCents: 0, owedCents: 350000 },
        ],
      },
    },
  });

  // And a settlement.
  const payment = await prisma.expense.create({
    data: {
      groupId: goa.id,
      description: "Sam paid Alex",
      amountCents: 500000,
      currency: "INR",
      date: daysAgo(2),
      category: "settlement",
      isPayment: true,
      splitMethod: "EXACT",
      createdById: sam.id,
      shares: {
        create: [
          { userId: sam.id, paidCents: 500000, owedCents: 0 },
          { userId: alex.id, paidCents: 0, owedCents: 500000 },
        ],
      },
    },
  });

  await prisma.comment.create({
    data: {
      expenseId: payment.id,
      userId: alex.id,
      body: "Got it, thanks!",
    },
  });

  await prisma.invitation.create({
    data: {
      targetUserId: jordan.id,
      invitedById: alex.id,
      email: jordan.email,
      groupId: goa.id,
    },
  });

  console.log("Seeded demo data:");
  for (const person of Object.values(DEMO)) console.log(`  ${person.name} — ${person.email}`);
  console.log(`\nGroups: ${goa.name}, ${flat.name}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
