import test from "node:test";
import assert from "node:assert/strict";
import { buildShares, computeOwed, SplitError, validatePayers } from "../src/lib/split";

const people = ["a", "b", "c"];

test("equal split covers the total exactly", () => {
  const owed = computeOwed("EQUAL", 1000, people.map((userId) => ({ userId })));
  assert.equal(owed.reduce((sum, o) => sum + o.owedCents, 0), 1000);
  assert.deepEqual(owed.map((o) => o.owedCents), [334, 333, 333]);
});

test("exact split must add up", () => {
  const owed = computeOwed("EXACT", 1000, [
    { userId: "a", value: 600 },
    { userId: "b", value: 400 },
  ]);
  assert.deepEqual(owed.map((o) => o.owedCents), [600, 400]);

  assert.throws(
    () => computeOwed("EXACT", 1000, [{ userId: "a", value: 900 }]),
    SplitError,
  );
});

test("percentages must total 100", () => {
  const owed = computeOwed("PERCENT", 1000, [
    { userId: "a", value: 2500 },
    { userId: "b", value: 7500 },
  ]);
  assert.deepEqual(owed.map((o) => o.owedCents), [250, 750]);

  assert.throws(
    () =>
      computeOwed("PERCENT", 1000, [
        { userId: "a", value: 2500 },
        { userId: "b", value: 2500 },
      ]),
    SplitError,
  );
});

test("shares weight the split", () => {
  const owed = computeOwed("SHARES", 900, [
    { userId: "a", value: 2 },
    { userId: "b", value: 1 },
  ]);
  assert.deepEqual(owed.map((o) => o.owedCents), [600, 300]);
});

test("adjustments come off the top before splitting the rest", () => {
  const owed = computeOwed("ADJUSTMENT", 1000, [
    { userId: "a", value: 200 },
    { userId: "b", value: 0 },
  ]);
  // 200 goes to a, remaining 800 split equally.
  assert.deepEqual(owed.map((o) => o.owedCents), [600, 400]);
  assert.equal(owed.reduce((sum, o) => sum + o.owedCents, 0), 1000);
});

test("rejects duplicates and empty splits", () => {
  assert.throws(() => computeOwed("EQUAL", 100, []), SplitError);
  assert.throws(
    () => computeOwed("EQUAL", 100, [{ userId: "a" }, { userId: "a" }]),
    SplitError,
  );
});

test("payers must cover the total", () => {
  assert.doesNotThrow(() => validatePayers([{ userId: "a", paidCents: 1000 }], 1000));
  assert.throws(() => validatePayers([{ userId: "a", paidCents: 900 }], 1000), SplitError);
  assert.throws(() => validatePayers([], 1000), SplitError);
});

test("a payer who also owes gets one merged share row", () => {
  const shares = buildShares(
    [{ userId: "a", paidCents: 1000 }],
    [
      { userId: "a", owedCents: 500 },
      { userId: "b", owedCents: 500 },
    ],
  );
  assert.deepEqual(shares, [
    { userId: "a", paidCents: 1000, owedCents: 500 },
    { userId: "b", paidCents: 0, owedCents: 500 },
  ]);
});
