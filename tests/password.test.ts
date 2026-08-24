import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "../src/lib/password-rules";

test("a hashed password verifies against itself and nothing else", async () => {
  const hash = await hashPassword("river-lamp-cotton");

  assert.equal(await verifyPassword("river-lamp-cotton", hash), true);
  assert.equal(await verifyPassword("river-lamp-cotto", hash), false);
  assert.equal(await verifyPassword("River-Lamp-Cotton", hash), false);
  assert.equal(await verifyPassword("", hash), false);
});

test("the plain password is nowhere in the stored hash", async () => {
  const hash = await hashPassword("correct-horse-battery");
  assert.ok(!hash.includes("correct"));
  assert.ok(!hash.toLowerCase().includes("horse"));
});

test("the same password hashes differently every time", async () => {
  const [a, b] = await Promise.all([hashPassword("same-input-twice"), hashPassword("same-input-twice")]);

  // Different salts, so two people who pick the same password don't reveal it
  // to each other by having matching rows.
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("same-input-twice", a), true);
  assert.equal(await verifyPassword("same-input-twice", b), true);
});

test("the stored format carries its own parameters", async () => {
  const hash = await hashPassword("parameters-please");
  const parts = hash.split("$");

  assert.equal(parts.length, 6);
  assert.equal(parts[0], "scrypt");
  assert.equal(Number(parts[1]), 16384);
});

test("a hash made at different cost settings still verifies", async () => {
  // Hand-built at a lower cost, standing in for a hash written before the
  // parameters were raised. It has to keep working, or everyone is locked out
  // the day the cost changes.
  const { scryptSync, randomBytes } = await import("node:crypto");
  const salt = randomBytes(16);
  const key = scryptSync("old-settings-password", salt, 32, { N: 1024, r: 8, p: 1 });
  const stored = ["scrypt", 1024, 8, 1, salt.toString("base64"), key.toString("base64")].join("$");

  assert.equal(await verifyPassword("old-settings-password", stored), true);
  assert.equal(await verifyPassword("wrong", stored), false);
});

test("junk in the password column fails the sign-in rather than the request", async () => {
  for (const junk of [
    null,
    "",
    "not-a-hash",
    "scrypt$16384$8$1$onlyfiveparts",
    "bcrypt$16384$8$1$c2FsdA==$a2V5",
    "scrypt$notanumber$8$1$c2FsdA==$a2V5",
    "scrypt$16383$8$1$c2FsdA==$a2V5", // N must be a power of two
    "scrypt$16384$8$1$$a2V5",
    "scrypt$16384$8$1$c2FsdA==$",
  ]) {
    assert.equal(await verifyPassword("anything", junk), false, `should reject ${junk}`);
  }
});

test("an absurd cost in a stored hash is refused, not attempted", async () => {
  const huge = ["scrypt", 1 << 24, 8, 1, "c2FsdA==", "a2V5"].join("$");
  assert.equal(await verifyPassword("anything", huge), false);
});

test("passwords that differ only by unicode spelling still match", async () => {
  // "é" written as one code point, and as "e" plus a combining accent. A phone
  // keyboard and a laptop keyboard may not agree on which one they send.
  const composed = "café-password";
  const decomposed = "café-password";
  assert.notEqual(composed, decomposed);

  const hash = await hashPassword(composed);
  assert.equal(await verifyPassword(decomposed, hash), true);
});

test("the length rule is the main rule", () => {
  assert.equal(passwordProblem("a".repeat(MIN_PASSWORD_LENGTH)), null);
  assert.match(passwordProblem("short") ?? "", /at least 8/);
  assert.match(passwordProblem("x".repeat(201)) ?? "", /too long/);
  assert.match(passwordProblem("        ") ?? "", /only spaces/);
});

test("the obvious guesses are turned away", () => {
  for (const guess of ["password", "PASSWORD", "12345678", "Password123", "iloveyou"]) {
    assert.notEqual(passwordProblem(guess), null, `should reject ${guess}`);
  }
});

test("a password can't just be the email address", () => {
  assert.notEqual(passwordProblem("karan@example.com", "karan@example.com"), null);
  assert.notEqual(passwordProblem("KARAN@example.com", "karan@example.com"), null);
  assert.notEqual(passwordProblem("karanmittal", "karanmittal@example.com"), null);

  // A short local part is a normal word — "anna" shouldn't ban "annapurna".
  assert.equal(passwordProblem("annapurna-hills", "anna@example.com"), null);
});
