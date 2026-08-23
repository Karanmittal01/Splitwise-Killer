/**
 * The app's logo. One component so the tab icon, the sidebar and every
 * signed-out page always show the same mark.
 */
export function BrandMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    // A local static asset at its display size — nothing to optimise, and it
    // avoids an image-transform round trip on every page.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon-192.png"
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-xl ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
