"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "./Avatar";
import { FormMessage } from "./form";
import { removeAvatarAction, updateAvatarAction } from "@/server/actions/account";
import { idleState, type ActionState } from "@/server/actions/types";

const TARGET_PX = 256;

/**
 * Shrink whatever came out of the camera roll to a square thumbnail before it
 * ever leaves the phone. A modern photo is several megabytes; this sends about
 * thirty kilobytes, which keeps uploads quick and the database small.
 */
async function toSquareThumbnail(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_PX;
  canvas.height = TARGET_PX;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");

  context.drawImage(bitmap, sx, sy, side, side, 0, 0, TARGET_PX, TARGET_PX);
  bitmap.close?.();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not read that image"))),
      "image/jpeg",
      0.85,
    );
  });
}

/**
 * Who you are, with the picture editable in place.
 *
 * The avatar itself is the upload button — tapping it (or the small control on
 * the right) opens the picker. One card, one copy of your face.
 */
export function ProfileCard({
  userId,
  name,
  email,
  image,
}: {
  userId: string;
  name: string;
  email: string | null;
  image: string | null;
}) {
  const [state, setState] = useState<ActionState>(idleState);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setState(idleState);

    startTransition(async () => {
      let thumbnail: Blob;
      try {
        thumbnail = await toSquareThumbnail(file);
      } catch {
        setState({ error: "That image couldn't be read. Try a different one.", ok: false });
        return;
      }

      setPreview(URL.createObjectURL(thumbnail));

      const payload = new FormData();
      payload.append("avatar", new File([thumbnail], "avatar.jpg", { type: "image/jpeg" }));
      const result = await updateAvatarAction(idleState, payload);
      setState(result);
      if (result.error) setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function onRemove() {
    startTransition(async () => {
      const result = await removeAvatarAction(idleState, new FormData());
      setState(result);
      setPreview(null);
    });
  }

  return (
    <div className="card p-4">
      <input
        ref={inputRef}
        id="avatar-input"
        type="file"
        accept="image/*"
        onChange={onPick}
        disabled={pending}
        className="hidden"
      />

      <div className="flex items-center gap-4">
        {/* Tapping the picture is the most obvious way to change it. */}
        <label htmlFor="avatar-input" className="relative cursor-pointer" title="Change picture">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            <Avatar id={userId} name={name} image={image} size={56} />
          )}
          <span className="absolute -right-0.5 -bottom-0.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--color-mint-600)] text-[10px] text-white ring-2 ring-[var(--surface-card)]">
            ✎
          </span>
        </label>

        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{name}</p>
          <p className="truncate text-sm muted">{email}</p>
        </div>

        {/* Compact on a phone — the name and email need that width more than a
            label does, and the pencil on the avatar already says "editable". */}
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <label
            htmlFor="avatar-input"
            className="btn btn-secondary cursor-pointer px-2.5 text-xs sm:px-4"
            aria-label={image ? "Change picture" : "Add a picture"}
          >
            {pending ? "…" : "✎"}
            <span className="hidden sm:inline">
              {pending ? "Saving…" : image ? "Change" : "Add photo"}
            </span>
          </label>
          {image && !pending && (
            <button type="button" onClick={onRemove} className="btn btn-ghost px-2 text-[11px]">
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 empty:hidden">
        <FormMessage state={state} />
      </div>
    </div>
  );
}
