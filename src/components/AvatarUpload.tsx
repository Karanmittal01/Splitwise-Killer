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

export function AvatarUpload({
  userId,
  name,
  image,
}: {
  userId: string;
  name: string;
  image: string | null;
}) {
  const [state, setState] = useState<ActionState>(idleState);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // The action is called directly with a FormData we build here — no hidden
  // form to keep in sync, and the resized blob goes up in place of the
  // original file.
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
      <h2 className="mb-3 font-semibold">Profile picture</h2>

      <div className="flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <Avatar id={userId} name={name} image={image} size={64} />
        )}

        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            id="avatar-input"
            type="file"
            accept="image/*"
            onChange={onPick}
            disabled={pending}
            className="hidden"
          />
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="avatar-input" className="btn btn-secondary cursor-pointer text-sm">
              {pending ? "Uploading…" : image ? "Change picture" : "Upload a picture"}
            </label>
            {image && (
              <button
                type="button"
                onClick={onRemove}
                disabled={pending}
                className="btn btn-ghost text-xs"
              >
                Remove
              </button>
            )}
          </div>

          <p className="mt-2 text-xs muted">
            Cropped to a square and shrunk on your phone before uploading, so it stays quick.
          </p>
        </div>
      </div>

      <div className="mt-3 empty:hidden">
        <FormMessage state={state} />
      </div>
    </div>
  );
}
