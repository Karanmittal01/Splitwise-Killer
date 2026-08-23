"use client";

import { useState } from "react";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./form";
import { setNicknameAction } from "@/server/actions/friends";

/**
 * A private label for somebody. Only you see it — their own account name is
 * untouched, which matters when they sign in and set a real name and picture.
 */
export function NicknameEditor({
  friendId,
  nickname,
  realName,
}: {
  friendId: string;
  nickname: string | null;
  realName: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost text-xs"
      >
        ✎ {nickname ? "Edit nickname" : "Add a nickname"}
      </button>
    );
  }

  return (
    <ActionForm action={setNicknameAction} className="mt-2 w-full">
      <input type="hidden" name="friendId" value={friendId} />
      <label className="label" htmlFor="nickname">
        Nickname — only you see this
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="nickname"
          name="nickname"
          className="field max-w-xs flex-1"
          defaultValue={nickname ?? ""}
          placeholder={realName}
          maxLength={60}
          autoFocus
        />
        <SubmitButton className="btn btn-secondary" pendingLabel="Saving…">
          Save
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">
          Cancel
        </button>
      </div>
      <p className="mt-1.5 text-xs muted">Leave it empty to go back to {realName}.</p>
    </ActionForm>
  );
}
