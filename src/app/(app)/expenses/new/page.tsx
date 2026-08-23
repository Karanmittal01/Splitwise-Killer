import { PageHeader } from "@/components/AppShell";
import { ExpenseForm, type FormGroup } from "@/components/ExpenseForm";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getConnections } from "@/lib/queries";
import { createExpenseAction } from "@/server/actions/expenses";

export const metadata = { title: "Add an expense" };

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string; friendId?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const [connections, rawGroups] = await Promise.all([
    getConnections(user.id),
    prisma.group.findMany({
      where: { members: { some: { userId: user.id } }, archived: false },
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

  const presetGroup = params.groupId ? groups.find((g) => g.id === params.groupId) : undefined;
  const presetFriend = params.friendId
    ? connections.find((c) => c.id === params.friendId)
    : undefined;

  const participants = presetGroup
    ? presetGroup.members.map((m) => m.id)
    : presetFriend
      ? [user.id, presetFriend.id]
      : [user.id];

  return (
    <>
      <PageHeader
        title="Add an expense"
        subtitle="Log what was spent and who it was for."
        back={
          presetGroup
            ? { href: `/groups/${presetGroup.id}`, label: presetGroup.name }
            : { href: "/dashboard", label: "Dashboard" }
        }
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
          action={createExpenseAction}
          submitLabel="Save expense"
          cancelHref={presetGroup ? `/groups/${presetGroup.id}` : "/dashboard"}
          initial={{
            groupId: presetGroup?.id ?? null,
            description: "",
            amount: "",
            currency: presetGroup?.currency ?? user.defaultCurrency,
            date: new Date().toISOString().slice(0, 10),
            category: "general",
            notes: "",
            splitMethod: "EQUAL",
            recurrence: "NONE",
            participants: participants.map((id) => ({ userId: id, value: "" })),
            payers: [{ userId: user.id, amount: "" }],
          }}
        />
      </div>
    </>
  );
}
