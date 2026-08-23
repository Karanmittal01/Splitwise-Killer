import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { SubmitButton } from "@/components/form";
import { category } from "@/lib/categories";
import { formatMoney } from "@/lib/money";
import { getExpenseForUser } from "@/lib/queries";
import { RECURRENCE_LABELS } from "@/lib/recurring";
import { displayName, requireUser } from "@/lib/session";
import {
  addCommentAction,
  deleteExpenseAction,
  deleteReceiptAction,
} from "@/server/actions/expenses";

const SPLIT_LABELS: Record<string, string> = {
  EQUAL: "Split equally",
  EXACT: "Split by exact amounts",
  PERCENT: "Split by percentage",
  SHARES: "Split by shares",
  ADJUSTMENT: "Equal split with adjustments",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const expense = await getExpenseForUser(id, user.id);
  return { title: expense?.description ?? "Expense" };
}

export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const expense = await getExpenseForUser(id, user.id);
  if (!expense) notFound();

  const cat = category(expense.category);
  const payers = expense.shares.filter((s) => s.paidCents > 0);
  const owers = expense.shares.filter((s) => s.owedCents > 0);
  const yourShare = expense.shares.find((s) => s.userId === user.id);
  const yourNet = (yourShare?.paidCents ?? 0) - (yourShare?.owedCents ?? 0);

  const backHref = expense.group ? `/groups/${expense.group.id}` : "/dashboard";
  const backLabel = expense.group ? expense.group.name : "Dashboard";

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand-soft)] text-xl">
              {expense.isPayment ? "💸" : cat.icon}
            </span>
            {expense.description}
          </span>
        }
        subtitle={
          <>
            {formatMoney(expense.amountCents, expense.currency)} ·{" "}
            {dateFormat.format(expense.date)}
            {expense.group && (
              <>
                {" · "}
                <Link href={`/groups/${expense.group.id}`} className="hover:underline">
                  {expense.group.emoji} {expense.group.name}
                </Link>
              </>
            )}
          </>
        }
        back={{ href: backHref, label: backLabel }}
        action={
          !expense.isPayment ? (
            <Link href={`/expenses/${expense.id}/edit`} className="btn btn-secondary">
              Edit
            </Link>
          ) : null
        }
      />

      {/* Your position on this expense */}
      <div className="card mb-4 px-4 py-3">
        {yourNet === 0 ? (
          <p className="text-sm muted">You&apos;re not out of pocket on this one.</p>
        ) : (
          <p className="text-sm">
            <span className="muted">{yourNet > 0 ? "You lent " : "You borrowed "}</span>
            <span
              className={`font-semibold ${yourNet > 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}
            >
              {formatMoney(Math.abs(yourNet), expense.currency)}
            </span>
          </p>
        )}
      </div>

      {/* Breakdown */}
      <section className="card mb-4 p-4">
        <h2 className="mb-3 text-sm font-semibold tracking-wide muted uppercase">
          {expense.isPayment ? "Payment" : SPLIT_LABELS[expense.splitMethod] ?? "Split"}
        </h2>

        <div className="divide-row">
          {payers.map((share) => (
            <Row
              key={`paid-${share.id}`}
              person={share.user}
              selfId={user.id}
              label="paid"
              amount={formatMoney(share.paidCents, expense.currency)}
              tone="positive"
            />
          ))}
          {owers.map((share) => (
            <Row
              key={`owes-${share.id}`}
              person={share.user}
              selfId={user.id}
              label={
                expense.isPayment ? "received" : share.userId === user.id ? "owe" : "owes"
              }
              amount={formatMoney(share.owedCents, expense.currency)}
              tone={expense.isPayment ? "positive" : "negative"}
            />
          ))}
        </div>

        {expense.recurrence !== "NONE" && (
          <p className="mt-3 chip">🔁 {RECURRENCE_LABELS[expense.recurrence]}</p>
        )}
        {expense.recurringOfId && (
          <p className="mt-3 chip">🔁 Created automatically from a repeating expense</p>
        )}
      </section>

      {expense.notes && (
        <section className="card mb-4 p-4">
          <h2 className="mb-2 text-sm font-semibold tracking-wide muted uppercase">Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{expense.notes}</p>
        </section>
      )}

      {expense.receipt && (
        <section className="card mb-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-wide muted uppercase">Receipt</h2>
            <ActionForm action={deleteReceiptAction} messagePosition="none">
              <input type="hidden" name="expenseId" value={expense.id} />
              <SubmitButton className="btn btn-ghost text-xs" pendingLabel="Removing…">
                Remove
              </SubmitButton>
            </ActionForm>
          </div>
          {expense.receipt.mimeType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/receipts/${expense.receipt.id}`}
              alt="Receipt"
              className="max-h-96 w-full rounded-xl object-contain"
            />
          ) : (
            <a
              href={`/api/receipts/${expense.receipt.id}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
            >
              Open receipt (PDF)
            </a>
          )}
        </section>
      )}

      {/* Comments */}
      <section className="card mb-4 p-4">
        <h2 className="mb-3 text-sm font-semibold tracking-wide muted uppercase">
          Comments {expense.comments.length > 0 && `(${expense.comments.length})`}
        </h2>

        {expense.comments.length === 0 ? (
          <p className="mb-3 text-sm muted">No comments yet.</p>
        ) : (
          <div className="mb-4 flex flex-col gap-3">
            {expense.comments.map((comment) => (
              <div key={comment.id} className="flex gap-2.5">
                <Avatar
                  id={comment.user.id}
                  name={displayName(comment.user)}
                  image={comment.user.image}
                  size={30}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">
                      {displayName(comment.user, user.id, comment.user.id)}
                    </span>{" "}
                    <span className="text-xs muted">{timeFormat.format(comment.createdAt)}</span>
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <ActionForm action={addCommentAction} className="flex gap-2" resetOnSuccess>
          <input type="hidden" name="expenseId" value={expense.id} />
          <input className="field" name="body" placeholder="Add a comment…" maxLength={1000} />
          <SubmitButton className="btn btn-secondary" pendingLabel="…">
            Post
          </SubmitButton>
        </ActionForm>
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs muted">
          Added by {displayName(expense.createdBy, user.id, expense.createdBy.id)} on{" "}
          {dateFormat.format(expense.createdAt)}
        </p>
        <ActionForm
          action={deleteExpenseAction}
          confirm="Delete this permanently? Balances will be recalculated."
          messagePosition="none"
        >
          <input type="hidden" name="expenseId" value={expense.id} />
          <SubmitButton className="btn btn-ghost text-[var(--negative)]" pendingLabel="Deleting…">
            Delete
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}

function Row({
  person,
  selfId,
  label,
  amount,
  tone,
}: {
  person: { id: string; name: string | null; email: string | null; phone: string | null; image: string | null };
  selfId: string;
  label: string;
  amount: string;
  tone: "positive" | "negative";
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Avatar id={person.id} name={displayName(person)} image={person.image} size={32} />
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className="font-medium">{displayName(person, selfId, person.id)}</span>{" "}
        <span className="muted">{label}</span>
      </span>
      <span
        className={`tabular-nums font-semibold ${tone === "positive" ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}
      >
        {amount}
      </span>
    </div>
  );
}
