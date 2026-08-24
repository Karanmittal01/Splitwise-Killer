import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { MAX_PASSWORD_LENGTH } from "./password-rules";

/**
 * Password hashing, built on Node's own scrypt.
 *
 * scrypt is deliberately slow and memory-hungry, which is exactly what you want
 * standing between a stolen database and somebody's password. Using the built-in
 * means no native module to compile and nothing extra to install — it works the
 * same on a laptop and on Vercel.
 *
 * A stored hash looks like `scrypt$N$r$p$salt$key`, with the parameters written
 * in alongside so that raising the cost later doesn't invalidate hashes that
 * were made at the old settings.
 */

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
// scrypt needs about 128 * N * r bytes, which at these settings is 16 MiB —
// uncomfortably close to Node's 32 MiB default. Ask for headroom explicitly so
// a future bump to N doesn't start throwing.
const MAXMEM = 64 * 1024 * 1024;

/** Hash a password for storage. Never store, log or return the plain text. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(normalise(password), salt, KEY_BYTES, {
    N,
    r: R,
    p: P,
    maxmem: MAXMEM,
  });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

/**
 * Check a password against a stored hash.
 *
 * Returns false rather than throwing for anything malformed, so a corrupt row
 * fails the sign-in instead of failing the request.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, rawN, rawR, rawP, rawSalt, rawKey] = parts;
  const n = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  // Bound the work: these come from our own database, but a bad row should not
  // be able to ask for gigabytes of memory.
  if (!isPowerOfTwo(n) || n > 1 << 20) return false;
  if (!Number.isInteger(r) || r < 1 || r > 32) return false;
  if (!Number.isInteger(p) || p < 1 || p > 16) return false;

  const salt = Buffer.from(rawSalt, "base64");
  const expected = Buffer.from(rawKey, "base64");
  if (salt.length === 0 || expected.length === 0) return false;

  let key: Buffer;
  try {
    key = await scryptAsync(normalise(password), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: MAXMEM,
    });
  } catch {
    return false;
  }

  return key.length === expected.length && timingSafeEqual(key, expected);
}

/**
 * Burn the same time a real check would, for an email that has no password on
 * it. Without this, "no such account" answers noticeably faster than "wrong
 * password" and the sign-in form quietly becomes a way to test whether somebody
 * is a member here.
 */
export async function equivalentWork(password: string): Promise<void> {
  await hashPassword(password.slice(0, MAX_PASSWORD_LENGTH));
}

/**
 * Unicode has several ways to write the same character, and a phone keyboard
 * may not pick the same one as a laptop. Normalising both on the way in and on
 * the way back means an accented password still matches itself.
 */
function normalise(password: string): string {
  return password.normalize("NFKC");
}

function isPowerOfTwo(value: number): boolean {
  return Number.isInteger(value) && value > 1 && (value & (value - 1)) === 0;
}
