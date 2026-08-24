import Link from "next/link";
import { Avatar } from "./Avatar";
import { NavLink, TabLink } from "./NavLink";
import { MobileMenu } from "./MobileMenu";
import type { CurrentUser } from "@/lib/session";
import { displayName } from "@/lib/session";
import { BrandMark } from "./BrandMark";

export type ShellGroup = { id: string; name: string; emoji: string };

export function AppShell({
  user,
  groups,
  unread,
  children,
}: {
  user: CurrentUser;
  groups: ShellGroup[];
  unread: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-[var(--surface-border)] px-3 py-5 md:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2">
          <BrandMark size={36} />
          <span className="text-[1.05rem] font-bold tracking-tight">Splitwise Killer</span>
        </Link>

        <nav className="flex flex-col gap-1">
          <NavLink href="/dashboard" icon="🏠" label="Dashboard" exact />
          <NavLink href="/groups" icon="👥" label="Groups" />
          <NavLink href="/friends" icon="🙋" label="Friends" />
          <NavLink href="/activity" icon="🔔" label="Activity" badge={unread} />
          <NavLink href="/notes" icon="🗒️" label="Personal notes" />
          <NavLink href="/account" icon="⚙️" label="Account" />
          <NavLink href="/contact" icon="💬" label="Contact" />
        </nav>

        {groups.length > 0 && (
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
            <p className="px-3 pb-2 text-[11px] font-bold tracking-wider muted uppercase">
              Your groups
            </p>
            <div className="flex flex-col gap-0.5">
              {groups.map((group) => (
                <NavLink
                  key={group.id}
                  href={`/groups/${group.id}`}
                  icon={group.emoji}
                  label={group.name}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-3 border-t border-[var(--surface-border)] pt-4">
          <Link href="/expenses/new" className="btn btn-primary w-full">
            + Add an expense
          </Link>
          <Link
            href="/account"
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[var(--surface-raised)]"
          >
            <Avatar id={user.id} name={displayName(user)} image={user.image} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{displayName(user)}</span>
              <span className="block truncate text-xs muted">{user.email}</span>
            </span>
          </Link>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--surface-border)] bg-[var(--surface-page)]/85 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <BrandMark size={32} />
            <span className="font-bold">Splitwise Killer</span>
          </Link>
          <MobileMenu
            userId={user.id}
            name={displayName(user)}
            email={user.email}
            image={user.image}
          />
        </header>

        <main className="min-w-0 flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-12">{children}</main>
      </div>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--surface-border)] bg-[var(--surface-card)] pb-[env(safe-area-inset-bottom)] md:hidden">
        <TabLink href="/dashboard" icon="🏠" label="Home" exact />
        <TabLink href="/groups" icon="👥" label="Groups" />
        <div className="relative w-16">
          <Link
            href="/expenses/new"
            aria-label="Add an expense"
            className="absolute -top-6 left-1/2 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-[var(--color-mint-600)] text-2xl text-white shadow-lg shadow-[var(--color-mint-600)]/30"
          >
            +
          </Link>
        </div>
        <TabLink href="/friends" icon="🙋" label="Friends" />
        <TabLink href="/activity" icon="🔔" label="Activity" badge={unread} />
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  back,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-5">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm muted hover:underline">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight md:text-[1.75rem]">{title}</h1>
          {subtitle && <div className="mt-1 text-sm muted">{subtitle}</div>}
        </div>
        {action}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="text-4xl">{icon}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-sm muted">{body}</p>
      {action}
    </div>
  );
}
