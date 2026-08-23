"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  icon,
  label,
  badge,
  exact = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] font-medium transition-colors ${
        active
          ? "bg-[var(--brand-soft)] text-[var(--brand)]"
          : "muted hover:bg-[var(--surface-raised)] hover:text-[var(--text-strong)]"
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge ? (
        <span className="rounded-full bg-[var(--color-coral-500)] px-1.5 py-0.5 text-[11px] font-bold text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

export function TabLink({
  href,
  icon,
  label,
  badge,
  exact = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold transition-colors ${
        active ? "text-[var(--brand)]" : "muted"
      }`}
    >
      <span className="text-[1.15rem] leading-none">{icon}</span>
      {label}
      {badge ? (
        <span className="absolute top-1 right-[22%] rounded-full bg-[var(--color-coral-500)] px-1.5 text-[10px] font-bold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  );
}
