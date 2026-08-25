"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./Avatar";

type Item = { href: string; icon: string; label: string };

/**
 * The phone equivalent of the desktop sidebar's lower links.
 *
 * The bottom bar only has room for the five core destinations, so everything
 * else — Personal notes, Contact, Account — lives behind the avatar in the top
 * bar. Tapping it opens a sheet; it closes on an outside tap or once you
 * navigate.
 */
export function MobileMenu({
  name,
  email,
  image,
  userId,
  showTools = false,
}: {
  name: string;
  email: string | null;
  image: string | null;
  userId: string;
  /** Passed down rather than derived here: OWNER_EMAIL is server-only. */
  showTools?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const items: Item[] = [
    { href: "/notes", icon: "🗒️", label: "Personal notes" },
    ...(showTools ? [{ href: "/tools", icon: "🛠️", label: "Tools" }] : []),
    { href: "/account", icon: "⚙️", label: "Account & appearance" },
    { href: "/contact", icon: "💬", label: "Contact & feedback" },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center rounded-full"
      >
        <Avatar id={userId} name={name} image={image} size={30} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute top-full right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-card)] shadow-xl"
          >
            <Link
              href="/account"
              className="flex items-center gap-3 border-b border-[var(--surface-border)] px-4 py-3"
            >
              <Avatar id={userId} name={name} image={image} size={38} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{name}</span>
                {email && <span className="block truncate text-xs muted">{email}</span>}
              </span>
            </Link>

            <nav className="flex flex-col p-1">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.9375rem] font-medium transition-colors hover:bg-[var(--surface-raised)]"
                >
                  <span className="text-lg leading-none">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
