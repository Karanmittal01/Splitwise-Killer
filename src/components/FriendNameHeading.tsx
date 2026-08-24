"use client";

import { useState, useTransition } from "react";
import { Avatar } from "./Avatar";
import { setNicknameAction } from "@/server/actions/friends";
import { idleState } from "@/server/actions/types";

/**
 * The friend's name in the page header, with a small pencil to rename them.
 *
 * "Name" here is your private label for this person (a nickname). It lives on
 * the friendship, never on their account, so whatever they later set as their
 * own Google name never overwrites the name you chose. Editing happens inline
 * — the name becomes an input in place, no separate section.
 */
export function FriendNameHeading({
  friendId,
  name,
  realName,
  nickname,
  image,
}: {
  friendId: string;
  /** What to show — the nickname if set, otherwise their real name. */
  name: string;
  realName: string;
  nickname: string | null;
  image: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nickname ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const payload = new FormData();
      payload.append("friendId", friendId);
      payload.append("nickname", value.trim());
      const result = await setNicknameAction(idleState, payload);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <span className="flex flex-col gap-1">
        <span className="flex items-center gap-2.5">
          <Avatar id={friendId} name={name} image={image} size={44} />
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder={realName}
            maxLength={60}
            className="field max-w-56 text-xl font-bold"
            aria-label="Name for this friend"
          />
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="btn btn-primary px-3 py-1.5 text-sm"
          >
            {pending ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setValue(nickname ?? "");
              setEditing(false);
            }}
            className="btn btn-ghost px-2 py-1.5 text-sm"
          >
            Cancel
          </button>
        </span>
        <span className="pl-[3.375rem] text-xs muted">
          {error ?? `Only you see this. Leave it empty to use ${realName}.`}
        </span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2.5">
      <Avatar id={friendId} name={name} image={image} size={44} />
      <span className="min-w-0 truncate">{name}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Edit name"
        aria-label="Edit name"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm muted transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-strong)]"
      >
        ✎
      </button>
    </span>
  );
}
