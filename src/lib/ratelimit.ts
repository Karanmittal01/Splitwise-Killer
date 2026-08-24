/**
 * A small in-process attempt counter, used to blunt password guessing.
 *
 * This is per server instance and resets on redeploy, so it is a speed bump
 * rather than a guarantee — on a serverless host an attacker spread across
 * instances gets more tries than the limit suggests. It still turns "hammer one
 * account until it opens" into something slow and noisy, which is the point.
 * If this ever needs to be airtight, the same interface can be backed by the
 * database or a KV store without touching the callers.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const DEFAULT_LIMIT = 8;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
// Bound the map so a flood of distinct keys can't grow it without limit.
const MAX_KEYS = 5000;

export function tooManyAttempts(key: string, limit = DEFAULT_LIMIT): boolean {
  const bucket = buckets.get(key);
  if (!bucket) return false;
  if (Date.now() > bucket.resetAt) {
    buckets.delete(key);
    return false;
  }
  return bucket.count >= limit;
}

export function recordAttempt(key: string, windowMs = DEFAULT_WINDOW_MS): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    if (buckets.size >= MAX_KEYS) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
}

/** Called after a success, so a correct password clears the slate. */
export function clearAttempts(key: string): void {
  buckets.delete(key);
}

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
  // Still full of live buckets: drop the oldest rather than refuse to record.
  if (buckets.size >= MAX_KEYS) {
    const oldest = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (const [key] of oldest.slice(0, Math.ceil(MAX_KEYS / 10))) buckets.delete(key);
  }
}
