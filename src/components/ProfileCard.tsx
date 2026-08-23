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
  const [menuOpen, setMenuOpen] = useState(false);
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

        {/* Just the pencil. With a picture set it opens a two-item menu so
            removing it is still possible without a stray label in the row. */}
        <div className="relative shrink-0">
          {image ? (
            <>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="btn btn-secondary px-2.5 text-xs"
                aria-label="Change or remove picture"
                aria-expanded={menuOpen}
              >
                {pending ? "…" : "✎"}
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-hidden
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute top-full right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] py-1 shadow-xl">
                    <label
                      htmlFor="avatar-input"
                      onClick={() => setMenuOpen(false)}
                      className="block cursor-pointer px-3 py-2 text-sm hover:bg-[var(--surface-raised)]"
                    >
                      Change picture
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onRemove();
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-[var(--negative)] hover:bg-[var(--surface-raised)]"
                    >
                      Remove picture
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <label
              htmlFor="avatar-input"
              className="btn btn-secondary cursor-pointer px-2.5 text-xs"
              aria-label="Add a picture"
            >
              {pending ? "…" : "✎"}
            </label>
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
