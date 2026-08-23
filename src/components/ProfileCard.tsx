"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "./Avatar";
import { FormMessage } from "./form";
import { ImageCropper } from "./ImageCropper";
import { removeAvatarAction, updateAvatarAction } from "@/server/actions/account";
import { idleState, type ActionState } from "@/server/actions/types";

/**
 * Who you are, with the picture editable in place.
 *
 * Picking a file opens the cropper; only the square you choose is uploaded,
 * already shrunk to 256px so a camera photo arrives as a few tens of kilobytes.
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
  const [picked, setPicked] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setState(idleState);
    setPicked(file);
  }

  function clearInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  function onCropped(blob: Blob) {
    setPicked(null);
    clearInput();
    setPreview(URL.createObjectURL(blob));

    startTransition(async () => {
      const payload = new FormData();
      payload.append("avatar", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const result = await updateAvatarAction(idleState, payload);
      setState(result);
      if (result.error) setPreview(null);
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

      {picked && (
        <ImageCropper
          file={picked}
          onCancel={() => {
            setPicked(null);
            clearInput();
          }}
          onDone={onCropped}
        />
      )}
    </div>
  );
}
