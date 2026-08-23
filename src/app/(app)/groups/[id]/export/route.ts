import { NextResponse } from "next/server";
import { centsToDecimalString } from "@/lib/money";
import { getGroupExpenses, getGroupOrThrow } from "@/lib/queries";
import { displayName } from "@/lib/session";
import { getCurrentUser } from "@/lib/session";

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Spreadsheet export — one row per expense, one column per member. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const group = await getGroupOrThrow(id, user.id);
  if (!group) return new NextResponse("Not found", { status: 404 });

  const expenses = await getGroupExpenses(group.id, { limit: 5000 });
  const members = group.members.map((m) => m.user);

  const header = [
    "Date",
    "Description",
    "Category",
    "Currency",
    "Amount",
    ...members.map((m) => displayName(m)),
  ];

  const rows = expenses.map((expense) => {
    const byUser = new Map(expense.shares.map((s) => [s.userId, s]));
    return [
      expense.date.toISOString().slice(0, 10),
      expense.description,
      expense.isPayment ? "Payment" : expense.category,
      expense.currency,
      centsToDecimalString(expense.amountCents, expense.currency),
      ...members.map((member) => {
        const share = byUser.get(member.id);
        if (!share) return "0";
        return centsToDecimalString(share.paidCents - share.owedCents, expense.currency);
      }),
    ];
  });

  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const filename = `${group.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-expenses.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
