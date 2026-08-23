import test from "node:test";
import assert from "node:assert/strict";
import { normaliseEmail, normalisePhone, phoneVariants } from "../src/lib/contact";

test("one human typed five ways is one number", () => {
  const expected = "+919876543210";
  for (const written of [
    "9876543210",
    "+919876543210",
    "+91 98765 43210",
    "91 98765 43210",
    "(+91) 9876543210",
    "098765 43210",
    "0091 98765 43210",
    "+91-98765-43210",
    "  9876 543 210  ",
  ]) {
    assert.equal(normalisePhone(written), expected, `failed for ${JSON.stringify(written)}`);
  }
});

test("international numbers keep their own country code", () => {
  assert.equal(normalisePhone("+1 415 555 2671"), "+14155552671");
  assert.equal(normalisePhone("+44 20 7946 0958"), "+442079460958");
  assert.equal(normalisePhone("0044 20 7946 0958"), "+442079460958");
});

test("rubbish is rejected", () => {
  assert.equal(normalisePhone(""), null);
  assert.equal(normalisePhone("   "), null);
  assert.equal(normalisePhone("hello"), null);
  assert.equal(normalisePhone("12345"), null); // too short even with a code
  assert.equal(normalisePhone("+1234567890123456789"), null); // too long
  assert.equal(normalisePhone(null), null);
});

test("variants cover numbers stored before canonicalisation", () => {
  const variants = phoneVariants("+91 98765 43210");
  for (const legacy of ["+919876543210", "919876543210", "9876543210", "09876543210"]) {
    assert.ok(variants.includes(legacy), `missing legacy form ${legacy}`);
  }
  assert.deepEqual(phoneVariants("nonsense"), []);
});

test("emails are lowercased and validated", () => {
  assert.equal(normaliseEmail("  Riya@Example.COM "), "riya@example.com");
  assert.equal(normaliseEmail("not-an-email"), null);
  assert.equal(normaliseEmail("a@b"), null);
  assert.equal(normaliseEmail(""), null);
});
