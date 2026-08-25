/**
 * Tools — personal utilities that happen to live inside this app.
 *
 * Everything here is pure and safe to import from a client component. The
 * server-only half — the worker's bearer-token check, which needs node:crypto —
 * lives in src/server/shopwise.ts, so that this file never drags Node built-ins
 * into the browser bundle.
 */

// ---------------------------------------------------------------------------
// Amex Shopwise purchase parameters
// ---------------------------------------------------------------------------

/**
 * What the portal charges. The face value is what the gift card is worth; on top
 * of it comes a convenience fee and GST on that fee, so a ₹1,000 card costs
 * about ₹1,017.70.
 *
 * These are for *display* only — the worker reads the real total off the
 * checkout page and refuses to pay outside its own computed range. Nothing here
 * can authorise a larger payment.
 */
export const SHOPWISE = {
  faceValueCents: 100_000,
  feePercent: 1.5,
  gstPercent: 18,
  totalRuns: 6,
} as const;

export function expectedChargeCents(faceValueCents: number = SHOPWISE.faceValueCents): {
  faceValueCents: number;
  feeCents: number;
  totalCents: number;
} {
  const feeCents = Math.round(
    (faceValueCents * SHOPWISE.feePercent) / 100 * (1 + SHOPWISE.gstPercent / 100),
  );
  return { faceValueCents, feeCents, totalCents: faceValueCents + feeCents };
}

/** 101770 → "₹1,017.70" */
export function formatRupees(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return `₹${(cents / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Human wording for each phase the worker reports. */
export const PHASE_LABELS: Record<string, string> = {
  opening: "Opening the portal",
  "logging-in": "Signing in",
  "finding-product": "Finding the gift card",
  verified: "Cart checked",
  paying: "Entering card details",
};

/** "2026-08" — one purchase is allowed per calendar month. */
export function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
