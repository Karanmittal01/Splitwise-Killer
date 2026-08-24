/**
 * What counts as an acceptable password.
 *
 * Kept free of any Node imports so the sign-up form can show the same rule it
 * will be judged by — `password.ts`, which does the hashing, pulls in
 * `node:crypto` and can never be reached from a client component.
 */

export const MIN_PASSWORD_LENGTH = 8;
// scrypt hashes the password before stretching it, so a huge one costs no more
// than a small one — but there's no reason to accept a megabyte of text either.
export const MAX_PASSWORD_LENGTH = 200;

/**
 * The handful of passwords that show up at the top of every breach dump. This
 * is not a serious dictionary check; it just stops the very worst choices from
 * sailing through the length rule.
 */
const TOO_COMMON = new Set([
  "password",
  "password1",
  "password123",
  "passw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyui",
  "qwerty123",
  "iloveyou",
  "letmein1",
  "welcome1",
  "abc12345",
  "11111111",
  "00000000",
  "football",
  "baseball",
  "sunshine",
  "princess",
  "trustno1",
  "splitwise",
]);

/**
 * Why this password can't be used, or null if it's fine.
 *
 * Kept deliberately gentle: length is what actually matters, so there are no
 * "must contain a symbol" rules that only ever produce `Password1!`.
 */
export function passwordProblem(password: string, email?: string | null): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return "That password is too long — keep it under 200 characters.";
  }
  if (password.trim().length === 0) {
    return "A password can't be only spaces.";
  }

  const lower = password.toLowerCase();
  if (TOO_COMMON.has(lower)) {
    return "That password is one of the first anyone would try. Please pick another.";
  }

  if (email) {
    const address = email.toLowerCase();
    const localPart = address.split("@")[0] ?? "";
    if (lower === address || (localPart.length >= 4 && lower === localPart)) {
      return "Your password can't be your email address.";
    }
  }

  return null;
}
