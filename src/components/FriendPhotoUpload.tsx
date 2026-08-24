"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { FormMessage } from "./form";
import { ImageCropper } from "./ImageCropper";
import { removeFriendPhotoAction, updateFriendPhotoAction } from "@/server/actions/friends";
import { idleState, type ActionState } from "@/server/actions/types";

/**
 * Their avatar, with a picture you can set yourself.
 *
 * Most people on a friends list have never signed in, so they have no picture
 * of their own and show up as two letters on a coloured circle. Being able to
 * put a face there is the difference between scanning a list and reading it.
 * Whatever you upload is yours alone — it never touches their account.
 */
export function FriendPhotoUpload({
  friendId,
  name,
  image,
  size = 52,
  /** True when the current picture is one you uploaded, so it can be removed. */
  hasOwnPhoto,
}: {
  friendId: string;
  name: string;
  image: string | null;
  size?: number;
  hasOwnPhoto: boolean;
}) {
  const [state, setState] = useState<ActionState>(idleState);
  const [picked, setPicked] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const inputId = `friend-photo-${friendId}`;

  function clearInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  function onCropped(blob: Blob) {
    setPicked(null);
    clearInput();
    setPreview(URL.createObjectURL(blob));

    startTransition(async () => {
      const payload = new FormData();
      payload.append("friendId", friendId);
      payload.append("photo", new File([blob], "friend.jpg", { type: "image/jpeg" }));
      const result = await updateFriendPhotoAction(idleState, payload);
      setState(result);
      if (result.error) setPreview(null);
      // Their face appears all over this page — the expense rows, the header.
      // Pull the server's version down so they all change at once.
      else router.refresh();
    });
  }

  function onRemove() {
    startTransition(async () => {
      const payload = new FormData();
      payload.append("friendId", friendId);
      const result = await removeFriendPhotoAction(idleState, payload);
      setState(result);
      if (!result.error) {
        setPreview(null);
        router.refresh();
      }
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setState(idleState);
          setPicked(file);
        }}
        disabled={pending}
        className="hidden"
      />

      <div className="relative shrink-0">
        {/* Tap the face to change it — with a tiny camera badge so it's clear
            that's a thing you can do. */}
        <button
          type="button"
          onClick={() => (hasOwnPhoto ? setMenuOpen((open) => !open) : inputRef.current?.click())}
          title="Set their picture"
          aria-label={`Set a picture for ${name}`}
          className="relative block cursor-pointer rounded-full"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              style={{ width: size, height: size }}
              className="rounded-full object-cover"
            />
          ) : (
            <Avatar id={friendId} name={name} image={image} size={size} />
          )}
          <span className="absolute -right-0.5 -bottom-0.5 grid h-5 w-5 place-items-center rounded-full bg-[var(--color-mint-600)] text-[10px] text-white ring-2 ring-[var(--surface-page)]">
            {pending ? "…" : "📷"}
          </span>
        </button>

        {menuOpen && (
          <>
            <button
              type="button"
              aria-hidden
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute top-full left-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] py-1 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  inputRef.current?.click();
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--surface-raised)]"
              >
                Change picture
              </button>
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

        {/* Anchored to the avatar so the message can't push the name around. */}
        {(state.error || state.message) && (
          <div className="absolute top-full left-0 z-10 mt-2 w-56">
            <FormMessage state={state} />
          </div>
        )}
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
    </>
  );
}
