import { PageHeader } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { SubmitButton } from "@/components/form";
import { CURRENCIES } from "@/lib/currencies";
import { signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { displayName, requireUser } from "@/lib/session";
import { updateProfileAction } from "@/server/actions/account";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();

  const [groupCount, expenseCount, friendCount] = await Promise.all([
    prisma.groupMember.count({ where: { userId: user.id } }),
    prisma.expenseShare.count({ where: { userId: user.id, expense: { deletedAt: null } } }),
    prisma.friendship.count({ where: { userId: user.id } }),
  ]);

  return (
    <>
      <PageHeader title="Account" subtitle="Your profile and preferences." />

      <div className="flex max-w-xl flex-col gap-6">
        <div className="card flex items-center gap-4 p-4">
          <Avatar id={user.id} name={displayName(user)} image={user.image} size={56} />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{displayName(user)}</p>
            <p className="truncate text-sm muted">{user.email}</p>
          </div>
        </div>

        <div className="card grid grid-cols-3 divide-x divide-[var(--surface-border)] p-4 text-center">
          <Stat label="Groups" value={groupCount} />
          <Stat label="Expenses" value={expenseCount} />
          <Stat label="Friends" value={friendCount} />
        </div>

        <ActionForm action={updateProfileAction} className="card flex flex-col gap-4 p-4">
          <h2 className="font-semibold">Profile</h2>

          <div>
            <label className="label" htmlFor="name">
              Display name
            </label>
            <input
              id="name"
              name="name"
              className="field"
              defaultValue={user.name ?? ""}
              maxLength={60}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="phone">
              Mobile number
            </label>
            <input
              id="phone"
              name="phone"
              className="field"
              defaultValue={user.phone ?? ""}
              placeholder="+91 98765 43210"
            />
            <p className="mt-1.5 text-xs muted">
              Adding it lets friends who only know your number find you — and links up any expenses
              already waiting on that number.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="defaultCurrency">
              Default currency
            </label>
            <select
              id="defaultCurrency"
              name="defaultCurrency"
              className="field"
              defaultValue={user.defaultCurrency}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <SubmitButton>Save profile</SubmitButton>
          </div>
        </ActionForm>

        <section className="card p-4">
          <h2 className="mb-1 font-semibold">Signed in with Google</h2>
          <p className="mb-3 text-sm muted">
            Your email address is how friends add you, so expenses find you automatically.
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <SubmitButton className="btn btn-secondary" pendingLabel="Signing out…">
              Sign out
            </SubmitButton>
          </form>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs muted">{label}</p>
    </div>
  );
}
