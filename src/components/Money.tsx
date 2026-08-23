import { formatMoney } from "@/lib/money";

/**
 * Renders an amount with the app's balance colour language:
 * green = coming to you, coral = you owe, muted = settled.
 */
export function Money({
  cents,
  currency,
  tone = "auto",
  className = "",
  showSign = false,
}: {
  cents: number;
  currency: string;
  tone?: "auto" | "positive" | "negative" | "neutral";
  className?: string;
  showSign?: boolean;
}) {
  const resolved =
    tone === "auto" ? (cents > 0 ? "positive" : cents < 0 ? "negative" : "neutral") : tone;

  const colour =
    resolved === "positive"
      ? "text-[var(--positive)]"
      : resolved === "negative"
        ? "text-[var(--negative)]"
        : "muted";

  const text = formatMoney(Math.abs(cents), currency);
  const sign = showSign && cents !== 0 ? (cents > 0 ? "+" : "−") : "";

  return (
    <span className={`tabular-nums font-semibold ${colour} ${className}`}>
      {sign}
      {text}
    </span>
  );
}

/** "you are owed ₹450" / "you owe ₹120" / "you are settled up" */
export function BalanceLine({
  cents,
  currency,
  size = "sm",
}: {
  cents: number;
  currency: string;
  size?: "sm" | "lg";
}) {
  if (cents === 0) {
    return <span className={`muted ${size === "lg" ? "text-base" : "text-sm"}`}>settled up</span>;
  }
  const owed = cents > 0;
  return (
    <span className={size === "lg" ? "text-base" : "text-sm"}>
      <span className="muted">{owed ? "you are owed " : "you owe "}</span>
      <Money cents={cents} currency={currency} />
    </span>
  );
}
