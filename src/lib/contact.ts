/**
 * Turning whatever somebody types into a canonical email address or phone
 * number. Pure functions with no database access, so they can be unit tested
 * and reused from anywhere.
 */

export function normaliseEmail(input: string | null | undefined): string | null {
  const value = input?.trim().toLowerCase();
  if (!value) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return null;
  return value;
}

/**
 * Default dialling code for numbers typed without one. Indian numbers are
 * usually written as ten bare digits, so "9876543210" has to mean the same
 * person as "+91 98765 43210" — otherwise one human ends up with two accounts
 * and two sets of balances.
 */
const DEFAULT_DIAL_CODE = (process.env.DEFAULT_COUNTRY_CODE ?? "91").replace(/\D/g, "");

/**
 * Turn anything a person might type into one canonical E.164 number.
 *
 *   9876543210        -> +919876543210
 *   +91 98765 43210   -> +919876543210
 *   (+91) 9876543210  -> +919876543210
 *   098765 43210      -> +919876543210
 *   0091 98765 43210  -> +919876543210
 */
export function normalisePhone(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;

  // A + anywhere near the front means the country code was written out, even
  // when it's wrapped in brackets like "(+91) 98765 43210".
  const explicitCode = /^[\s(]*\+/.test(raw);
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;

  if (digits.startsWith("00")) {
    // International prefix used instead of "+".
    digits = digits.slice(2);
  } else if (!explicitCode) {
    if (digits.startsWith("0")) {
      // National trunk prefix: drop it and apply the default country code.
      digits = DEFAULT_DIAL_CODE + digits.replace(/^0+/, "");
    } else if (digits.length <= 10) {
      // A bare local number.
      digits = DEFAULT_DIAL_CODE + digits;
    }
  }

  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/**
 * Every stored form a number might already exist as.
 *
 * Numbers saved before canonicalisation could be sitting in the database
 * without a "+" or country code, so lookups check the older shapes too rather
 * than creating a duplicate person.
 */
export function phoneVariants(input: string | null | undefined): string[] {
  const canonical = normalisePhone(input);
  if (!canonical) return [];

  const digits = canonical.slice(1);
  const variants = new Set<string>([canonical, digits]);

  if (digits.startsWith(DEFAULT_DIAL_CODE)) {
    const local = digits.slice(DEFAULT_DIAL_CODE.length);
    if (local.length >= 6) {
      variants.add(local);
      variants.add(`0${local}`);
      variants.add(`+${local}`);
    }
  }
  return [...variants];
}
