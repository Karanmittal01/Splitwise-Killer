import { currencyInfo } from "./currencies";

/**
 * All money in this app is an integer count of minor units ("cents").
 * These helpers are the only place where the conversion to and from a
 * human-readable decimal string happens.
 */

export function parseMoneyToCents(input: string | number, currency = "INR"): number {
  const { decimals } = currencyInfo(currency);
  const raw = typeof input === "number" ? String(input) : input.trim();
  if (raw === "") return NaN;

  // Accept "1,234.56", "1 234,56", "₹1234.5" and friends.
  const cleaned = raw.replace(/[^\d.,-]/g, "");
  if (cleaned === "" || cleaned === "-") return NaN;

  let normalised = cleaned;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is the decimal separator.
    normalised =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimalsAfter = cleaned.length - lastComma - 1;
    normalised =
      decimalsAfter > 0 && decimalsAfter <= 2
        ? cleaned.replace(",", ".")
        : cleaned.replace(/,/g, "");
  }

  const value = Number(normalised);
  if (!Number.isFinite(value)) return NaN;
  return Math.round(value * 10 ** decimals);
}

export function centsToDecimalString(cents: number, currency = "INR"): string {
  const { decimals } = currencyInfo(currency);
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const unit = 10 ** decimals;
  const whole = Math.floor(abs / unit);
  const frac = abs % unit;
  const text = decimals === 0 ? String(whole) : `${whole}.${String(frac).padStart(decimals, "0")}`;
  return negative ? `-${text}` : text;
}

/** e.g. formatMoney(123456, "INR") -> "₹1,234.56" */
export function formatMoney(cents: number, currency = "INR", opts?: { signed?: boolean }): string {
  const info = currencyInfo(currency);
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const amount = abs / 10 ** info.decimals;

  let body: string;
  try {
    body = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: info.code,
      minimumFractionDigits: info.decimals,
      maximumFractionDigits: info.decimals,
    }).format(amount);
  } catch {
    body = `${info.symbol}${amount.toFixed(info.decimals)}`;
  }

  if (opts?.signed && negative) return `-${body}`;
  return body;
}

/**
 * Split `total` into `count` parts that sum exactly back to `total`.
 * The remainder cents go to the first parts, which is what Splitwise does.
 */
export function splitEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const base = Math.floor(abs / count);
  const remainder = abs - base * count;
  return Array.from({ length: count }, (_, i) => sign * (base + (i < remainder ? 1 : 0)));
}

/**
 * Distribute `total` across the given weights so the parts sum exactly to
 * `total` (largest-remainder method). Used for percentage and share splits.
 */
export function splitByWeights(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return splitEvenly(total, weights.length);

  const exact = weights.map((w) => (total * w) / sum);
  const floors = exact.map((v) => Math.floor(v));
  let remainder = total - floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  let idx = 0;
  while (remainder > 0 && order.length > 0) {
    result[order[idx % order.length].i] += 1;
    remainder -= 1;
    idx += 1;
  }
  while (remainder < 0 && order.length > 0) {
    result[order[idx % order.length].i] -= 1;
    remainder += 1;
    idx += 1;
  }
  return result;
}
