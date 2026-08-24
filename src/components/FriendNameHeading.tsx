"use client";

import { useState, useTransition } from "react";
import { FriendPhotoUpload } from "./FriendPhotoUpload";
import { setNicknameAction } from "@/server/actions/friends";
import { idleState } from "@/server/actions/types";

/**
 * The friend's identity block: avatar on the left, name and contact details
 * stacked beside it, with a pencil to rename.
 *
 * "Name" here is your private label for this person (a nickname). It lives on
 * the friendship, never on their account, so whatever they later set as their
 * own Google name never overwrites the name you chose. Editing happens inline.
 */
export function FriendNameHeading({
  friendId,
  name,
  realName,
  nickname,
  image,
  email,
  phone,
  hasOwnPhoto,
}: {
  friendId: string;
  /** What to show — the nickname if set, otherwise their real name. */
  name: string;
  realName: string;
  nickname: string | null;
  image: string | null;
  email: string | null;
  phone: string | null;
  /** True when the picture shown is one you uploaded, so it can be removed. */
  hasOwnPhoto: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nickname ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Real name (when a nickname is set) then every way to reach them, so both
  // an email and a phone show together rather than one hiding the other.
  const details = [nickname ? realName : null, email, phone].filter(Boolean) as string[];

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

  return (
    <div className="flex min-w-0 items-center gap-3">
      <FriendPhotoUpload
        friendId={friendId}
        name={name}
        image={image}
        hasOwnPhoto={hasOwnPhoto}
      />

      {editing ? (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
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
              className="field max-w-52 text-xl font-bold"
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
          </div>
          <p className="mt-1 text-xs muted">
            {error ?? `Only you see this. Leave it empty to use ${realName}.`}
          </p>
        </div>
      ) : (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="truncate text-2xl font-bold tracking-tight">{name}</h1>
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Edit name"
              aria-label="Edit name"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm muted transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-strong)]"
            >
              ✎
            </button>
          </div>
          {details.length > 0 && (
            <div className="mt-0.5 space-y-0.5 text-sm muted">
              {details.map((detail) => (
                <p key={detail} className="truncate">
                  {detail}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
