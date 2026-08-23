"use client";

import { useFormStatus } from "react-dom";
import type { ActionState } from "@/server/actions/types";

export function SubmitButton({
  children,
  className = "btn btn-primary",
  pendingLabel,
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.error && !state.message) return null;
  const isError = Boolean(state.error);
  return (
    <p
      role="status"
      className={`animate-rise rounded-xl px-3 py-2 text-sm ${
        isError
          ? "bg-[var(--color-coral-50)] text-[var(--color-coral-700)] dark:bg-[#3a1d15] dark:text-[var(--color-coral-300)]"
          : "bg-[var(--brand-soft)] text-[var(--brand)]"
      }`}
    >
      {state.error ?? state.message}
    </p>
  );
}
