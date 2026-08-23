import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { ExpenseForm, type FormGroup } from "@/components/ExpenseForm";
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

  const participants = expense.shares
    .filter((s) => s.owedCents > 0)
    .map((s) => ({
      userId: s.userId,
      value:
        expense.splitMethod === "EXACT"
          ? centsToDecimalString(s.owedCents, expense.currency)
          : expense.splitMethod === "PERCENT"
            ? ((s.owedCents / expense.amountCents) * 100).toFixed(2)
            : "",
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
            // Shares are already materialised, so re-opening the form with an
            // exact split reproduces the saved numbers no matter how it was
            // originally entered.
            splitMethod: expense.splitMethod === "EQUAL" ? "EQUAL" : "EXACT",
            recurrence: expense.recurrence,
            participants:
              expense.splitMethod === "EQUAL"
                ? participants.map((p) => ({ ...p, value: "" }))
                : expense.shares
                    .filter((s) => s.owedCents > 0)
                    .map((s) => ({
                      userId: s.userId,
                      value: centsToDecimalString(s.owedCents, expense.currency),
                    })),
            payers,
            hasReceipt: Boolean(expense.receipt),
          }}
        />
      </div>
    </>
  );
}
