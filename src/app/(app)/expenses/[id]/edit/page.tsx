import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { ExpenseForm, type FormGroup } from "@/components/ExpenseForm";
import type { SplitMethod } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { centsToDecimalString } from "@/lib/money";
import { getConnections, getExpenseForUser } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { updateExpenseAction } from "@/server/actions/expenses";

export const metadata = { title: "Edit expense" };

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const expense = await getExpenseForUser(id, user.id);
  if (!expense) notFound();
  if (expense.isPayment) redirect(`/expenses/${id}`);

  const [connections, rawGroups] = await Promise.all([
    getConnections(user.id),
    prisma.group.findMany({
      where: { members: { some: { userId: user.id } } },
      select: {
        id: true,
        name: true,
        emoji: true,
        currency: true,
        members: {
          select: {
            user: { select: { id: true, name: true, email: true, phone: true, image: true, isPlaceholder: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const groups: FormGroup[] = rawGroups.map((group) => ({
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    currency: group.currency,
    members: group.members.map((m) => m.user),
  }));

  // Everyone on the expense, including anybody who owes nothing. One person
  // carrying the whole bill is an ordinary shape now, and dropping the other
  // from the form would quietly rewrite the expense on save.
  const owing = expense.shares.filter((s) => s.owedCents > 0);

  // That shape re-opens as shares rather than exact amounts, so the form still
  // recognises it as one of the four one-on-one options — and changing the
  // total afterwards doesn't leave a stale figure behind in the split.
  const wholeOnOne =
    expense.splitMethod !== "EQUAL" &&
    owing.length === 1 &&
    owing[0].owedCents === expense.amountCents;

  const splitMethod: SplitMethod =
    expense.splitMethod === "EQUAL" ? "EQUAL" : wholeOnOne ? "SHARES" : "EXACT";

  const participants = expense.shares.map((s) => ({
    userId: s.userId,
    value:
      splitMethod === "EQUAL"
        ? ""
        : splitMethod === "SHARES"
          ? s.owedCents > 0
            ? "1"
            : "0"
          : centsToDecimalString(s.owedCents, expense.currency),
  }));

  const payers = expense.shares
    .filter((s) => s.paidCents > 0)
    .map((s) => ({
      userId: s.userId,
      amount: centsToDecimalString(s.paidCents, expense.currency),
    }));

  return (
    <>
      <PageHeader
        title="Edit expense"
        back={{ href: `/expenses/${expense.id}`, label: expense.description }}
      />

      <div className="max-w-2xl">
        <ExpenseForm
          self={{
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            image: user.image,
          }}
          connections={connections}
          groups={groups}
          action={updateExpenseAction}
          submitLabel="Save changes"
          cancelHref={`/expenses/${expense.id}`}
          initial={{
            id: expense.id,
            groupId: expense.groupId,
            description: expense.description,
            amount: centsToDecimalString(expense.amountCents, expense.currency),
            currency: expense.currency,
            date: expense.date.toISOString().slice(0, 10),
            category: expense.category,
            notes: expense.notes ?? "",
            // Shares are already materialised, so re-opening the form
            // reproduces the saved numbers no matter how they were entered.
            splitMethod,
            recurrence: expense.recurrence,
            participants,
            payers,
            hasReceipt: Boolean(expense.receipt),
          }}
        />
      </div>
    </>
  );
}
