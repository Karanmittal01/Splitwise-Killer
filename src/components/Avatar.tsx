import { initials } from "@/lib/names";

const PALETTE = [
  "#1fa383",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#ef4444",
  "#14b8a6",
  "#6366f1",
];

function colourFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function Avatar({
  name,
  image,
  id,
  size = 40,
  ring = false,
}: {
  name: string;
  image?: string | null;
  id: string;
  size?: number;
  ring?: boolean;
}) {
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(11, Math.round(size * 0.36)),
  };

  if (image) {
    return (
      // Plain <img>: avatars come straight from Google's CDN, so there is
      // nothing to optimise and no image-transform bill on the free tier.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        referrerPolicy="no-referrer"
        style={style}
        className={`shrink-0 rounded-full object-cover ${ring ? "ring-2 ring-white/70" : ""}`}
      />
    );
  }

  return (
    <span
      style={{ ...style, background: colourFor(id) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${
        ring ? "ring-2 ring-white/70" : ""
      }`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({
  people,
  size = 26,
  max = 5,
}: {
  people: { id: string; name: string; image?: string | null }[];
  size?: number;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="flex items-center">
      {shown.map((person, index) => (
        <span key={person.id} style={{ marginLeft: index === 0 ? 0 : -8 }}>
          <Avatar id={person.id} name={person.name} image={person.image} size={size} ring />
        </span>
      ))}
      {rest > 0 && (
        <span
          style={{ width: size, height: size, marginLeft: -8, fontSize: size * 0.34 }}
          className="inline-flex items-center justify-center rounded-full bg-[var(--surface-raised)] font-semibold muted ring-2 ring-white/70"
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
