"use client";

import { useActionState } from "react";
import { FormMessage } from "./form";
import { idleState, type ActionState } from "@/server/actions/types";

/**
 * A thin client wrapper so any server action can be used from a plain form and
 * still show its own success/error message inline.
 */
export function ActionForm({
  action,
  children,
  className,
  confirm,
  messagePosition = "below",
  resetOnSuccess = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  /** When set, the browser asks this question before submitting. */
  confirm?: string;
  messagePosition?: "above" | "below" | "none";
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, idleState);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) {
          event.preventDefault();
          return;
        }
        if (resetOnSuccess) {
          const form = event.currentTarget;
          // Clear the inputs once React has handed the payload to the action.
          setTimeout(() => form.reset(), 0);
        }
      }}
    >
      {messagePosition === "above" && <FormMessage state={state} />}
      {children}
      {messagePosition === "below" && <FormMessage state={state} />}
    </form>
  );
}
