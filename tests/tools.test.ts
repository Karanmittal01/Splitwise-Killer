import test from "node:test";
import assert from "node:assert/strict";
import { expectedChargeCents, formatRupees, monthKey, SHOPWISE } from "../src/lib/tools";
import { isOwner } from "../src/lib/owner";

test("the quoted charge includes the portal's convenience fee and GST", () => {
  const charge = expectedChargeCents();
  assert.equal(charge.faceValueCents, 100_000);
  // ₹1,000 × 1.5% = ₹15, plus 18% GST on that fee = ₹17.70.
  assert.equal(charge.feeCents, 1_770);
  assert.equal(charge.totalCents, 101_770);
});

test("the charge scales with the face value", () => {
  const charge = expectedChargeCents(500_00);
  assert.equal(charge.feeCents, 885); // ₹8.85
  assert.equal(charge.totalCents, 50_885);
});

test("money is rendered the way the rest of the app renders it", () => {
  assert.equal(formatRupees(101_770), "₹1,017.70");
  assert.equal(formatRupees(100_000), "₹1,000.00");
  assert.equal(formatRupees(0), "₹0.00");
  assert.equal(formatRupees(null), "—");
  assert.equal(formatRupees(undefined), "—");
});

test("Tools is invisible unless the signed-in email is the owner's", () => {
  const previous = process.env.OWNER_EMAIL;
  try {
    process.env.OWNER_EMAIL = "owner@example.com";
    assert.equal(isOwner({ email: "owner@example.com" }), true);
    // Case and stray whitespace should not decide who owns the deployment.
    assert.equal(isOwner({ email: "  Owner@Example.COM  " }), true);

    assert.equal(isOwner({ email: "someone@example.com" }), false);
    assert.equal(isOwner({ email: null }), false);
    assert.equal(isOwner(null), false);

    // Unset: nobody is the owner, so Tools stays hidden for everybody.
    process.env.OWNER_EMAIL = "";
    assert.equal(isOwner({ email: "owner@example.com" }), false);
  } finally {
    process.env.OWNER_EMAIL = previous;
  }
});

test("an empty OWNER_EMAIL cannot be matched by an empty session email", () => {
  const previous = process.env.OWNER_EMAIL;
  try {
    process.env.OWNER_EMAIL = "";
    assert.equal(isOwner({ email: "" }), false);
    process.env.OWNER_EMAIL = "   ";
    assert.equal(isOwner({ email: "   " }), false);
  } finally {
    process.env.OWNER_EMAIL = previous;
  }
});

test("monthKey buckets a purchase into its calendar month", () => {
  assert.equal(monthKey(new Date("2026-08-25T12:00:00Z")), "2026-08");
  assert.equal(monthKey(new Date("2026-01-01T00:00:00Z")), "2026-01");
  assert.equal(monthKey(new Date("2026-12-31T23:00:00Z")), "2026-12");
});

test("six purchases is the configured run of the schedule", () => {
  assert.equal(SHOPWISE.totalRuns, 6);
});
