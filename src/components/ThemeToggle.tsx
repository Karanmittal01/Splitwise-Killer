"use client";

import { useOptimistic, useTransition } from "react";
import { setThemeAction } from "@/server/actions/theme";
import type { Theme } from "@/lib/theme";

const OPTIONS: { id: Theme; label: string; icon: string }[] = [
  { id: "light", label: "Light", icon: "☀️" },
  { id: "dark", label: "Dark", icon: "🌙" },
  { id: "system", label: "System", icon: "🖥️" },
];

/**
 * Light / dark / follow-the-device.
 *
 * The choice is a cookie the server reads when rendering <html>, so switching
 * costs one round trip but never flashes the wrong palette. The optimistic
 * state makes the button feel instant while that happens.
 */
export function ThemeToggle({ current }: { current: Theme }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(current);

  function choose(theme: Theme) {
    startTransition(async () => {
      setOptimistic(theme);
      await setThemeAction(theme);
    });
  }

  return (
    <div
      className="flex gap-1 rounded-xl bg-[var(--surface-raised)] p-1"
      role="group"
      aria-label="Theme"
    >
      {OPTIONS.map((option) => {
        const active = optimistic === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => choose(option.id)}
            disabled={pending}
            aria-pressed={active}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              active
                ? "bg-[var(--surface-card)] text-[var(--brand)] shadow-sm"
                : "muted hover:text-[var(--text-strong)]"
            }`}
          >
            <span aria-hidden="true">{option.icon}</span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
