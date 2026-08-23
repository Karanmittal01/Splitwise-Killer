"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const OUTPUT_PX = 256;
const MAX_ZOOM = 4;

type Offset = { x: number; y: number };

/**
 * Pick the square that actually gets used as somebody's avatar.
 *
 * Drag to move, pinch or use the slider to zoom. The image is drawn into a
 * square canvas at 256px on confirm, so what leaves the phone is a few tens of
 * kilobytes regardless of what came out of the camera. No cropping library —
 * it is a transform on an <img> plus one drawImage call.
 */
export function ImageCropper({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [viewport, setViewport] = useState(280);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; from: Offset } | null>(null);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  // Load the picked file and remember its real dimensions.
  useEffect(() => {
    // `cancelled` matters: React runs effects twice in development, and the
    // first cleanup revokes the URL the first load is still using. Without
    // this the stale load fails and reports an error for a perfectly good
    // image.
    let cancelled = false;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    setError(null);

    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      imageRef.current = image;
      setNatural({ w: image.naturalWidth, h: image.naturalHeight });
    };
    image.onerror = () => {
      if (cancelled) return;
      setError("That image couldn't be read. Try a different one.");
    };
    image.src = objectUrl;

    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  // The crop frame is square and sized to the screen.
  useEffect(() => {
    function measure() {
      const width = frameRef.current?.clientWidth;
      if (width) setViewport(width);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [url]);

  // At zoom 1 the image exactly covers the frame — never less, so there are no
  // empty corners to crop into.
  const baseScale = natural ? viewport / Math.min(natural.w, natural.h) : 1;
  const displayW = natural ? natural.w * baseScale * zoom : 0;
  const displayH = natural ? natural.h * baseScale * zoom : 0;

  const clamp = useCallback(
    (next: Offset, w: number, h: number): Offset => ({
      x: Math.min(0, Math.max(viewport - w, next.x)),
      y: Math.min(0, Math.max(viewport - h, next.y)),
    }),
    [viewport],
  );

  // Keep the frame covered whenever the zoom or the frame size changes.
  useEffect(() => {
    if (!natural) return;
    setOffset((current) => {
      const w = natural.w * baseScale * zoom;
      const h = natural.h * baseScale * zoom;
      return clamp(current, w, h);
    });
  }, [zoom, natural, baseScale, clamp]);

  // Centre the image once per picked file. Re-centring on every zoom change
  // would fight the dragging.
  const centred = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!natural || centred.current === imageRef.current) return;
    centred.current = imageRef.current;
    const w = natural.w * baseScale * zoom;
    const h = natural.h * baseScale * zoom;
    setOffset({ x: (viewport - w) / 2, y: (viewport - h) / 2 });
  }, [natural, baseScale, viewport, zoom]);

  function onPointerDown(event: React.PointerEvent) {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      drag.current = null;
      return;
    }
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      from: offset,
    };
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = distance / (pinch.current.distance || 1);
      setZoom(Math.min(MAX_ZOOM, Math.max(1, pinch.current.zoom * ratio)));
      return;
    }

    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    setOffset(
      clamp(
        {
          x: state.from.x + (event.clientX - state.startX),
          y: state.from.y + (event.clientY - state.startY),
        },
        displayW,
        displayH,
      ),
    );
  }

  function onPointerUp(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }

  async function confirm() {
    const image = imageRef.current;
    if (!image || !natural) return;
    setWorking(true);

    try {
      // Translate the on-screen frame back into source-image pixels.
      const effective = baseScale * zoom;
      const sourceSize = viewport / effective;
      const sx = -offset.x / effective;
      const sy = -offset.y / effective;

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_PX;
      canvas.height = OUTPUT_PX;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable");
      context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, OUTPUT_PX, OUTPUT_PX);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85),
      );
      if (!blob) throw new Error("Could not export the crop");
      onDone(blob);
    } catch {
      setError("That image couldn't be cropped. Try a different one.");
      setWorking(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Crop your picture"
    >
      <div className="card w-full max-w-sm p-4">
        <h2 className="mb-1 font-semibold">Crop your picture</h2>
        <p className="mb-3 text-xs muted">Drag to reposition, pinch or slide to zoom.</p>

        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative aspect-square w-full touch-none overflow-hidden rounded-xl bg-[var(--surface-raised)] select-none"
          style={{ cursor: "grab" }}
        >
          {url && natural && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              draggable={false}
              className="absolute origin-top-left will-change-transform"
              style={{
                width: displayW,
                height: displayH,
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                maxWidth: "none",
              }}
            />
          )}
          {/* A circle showing how it will actually appear as an avatar. */}
          <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/20 ring-inset">
            <div className="absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>
        </div>

        <label className="mt-4 block">
          <span className="label">Zoom</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-[var(--color-mint-600)]"
            aria-label="Zoom"
          />
        </label>

        {error && <p className="mt-2 text-sm text-[var(--negative)]">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={confirm}
            disabled={!natural || working}
            className="btn btn-primary flex-1"
          >
            {working ? "Saving…" : "Use photo"}
          </button>
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
