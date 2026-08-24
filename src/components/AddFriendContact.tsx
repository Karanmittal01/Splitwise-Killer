"use client";

import { useState } from "react";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./form";
import { addFriendContactAction } from "@/server/actions/friends";

/**
 * Add an email or mobile number to a friend who has neither yet, or who you
 * only have one way to reach. If what you type already belongs to another
 * friend, the two are recognised as the same person and merged.
 */
export function AddFriendContact({
  friendId,
  hasEmail,
  hasPhone,
}: {
  friendId: string;
  hasEmail: boolean;
  hasPhone: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Nothing to add if we already have both.
  if (hasEmail && hasPhone) return null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost text-xs">
        ＋ Add {hasEmail ? "mobile number" : hasPhone ? "email" : "email or mobile"}
      </button>
    );
  }

  return (
    <ActionForm action={addFriendContactAction} className="w-full">
      <input type="hidden" name="friendId" value={friendId} />
      <label className="label" htmlFor="handle">
        Add email or mobile number
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="handle"
          name="handle"
          className="field max-w-xs flex-1"
          placeholder="riya@gmail.com or +91 98765 43210"
          autoFocus
        />
        <SubmitButton className="btn btn-secondary" pendingLabel="Saving…">
          Save
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">
          Cancel
        </button>
      </div>
      <p className="mt-1.5 text-xs muted">
        If it matches another friend, we&apos;ll merge them into one.
      </p>
    </ActionForm>
  );
}
