import test from "node:test";
import assert from "node:assert/strict";
import { computeBalances, simplifyDebts, summariseForUser } from "../src/lib/balances";

/** Dinner: A pays 900, split three ways. */
const dinner = {
  currency: "INR",
  shares: [
    { userId: "a", paidCents: 900, owedCents: 300 },
    { userId: "b", paidCents: 0, owedCents: 300 },
    { userId: "c", paidCents: 0, owedCents: 300 },
  ],
};

test("a simple expense produces the two obvious debts", () => {
  const [bucket] = computeBalances([dinner]);
  assert.equal(bucket.currency, "INR");
  assert.equal(bucket.net.get("a"), 600);
  assert.equal(bucket.net.get("b"), -300);
  assert.deepEqual(
    bucket.debts.map((d) => `${d.fromUserId}->${d.toUserId}:${d.amountCents}`).sort(),
    ["b->a:300", "c->a:300"],
  );
});

test("a payment cancels the debt it settles", () => {
  const payment = {
    currency: "INR",
    shares: [
      { userId: "b", paidCents: 300, owedCents: 0 },
      { userId: "a", paidCents: 0, owedCents: 300 },
    ],
  };
  const [bucket] = computeBalances([dinner, payment]);
  assert.equal(bucket.net.get("b"), 0);
  assert.deepEqual(
    bucket.debts.map((d) => `${d.fromUserId}->${d.toUserId}:${d.amountCents}`),
    ["c->a:300"],
  );
});

test("multiple payers are allocated proportionally and exactly", () => {
  const [bucket] = computeBalances([
    {
      currency: "USD",
      shares: [
        { userId: "a", paidCents: 700, owedCents: 250 },
        { userId: "b", paidCents: 300, owedCents: 250 },
        { userId: "c", paidCents: 0, owedCents: 250 },
        { userId: "d", paidCents: 0, owedCents: 250 },
      ],
    },
  ]);
  const total = bucket.debts.reduce((sum, d) => sum + d.amountCents, 0);
  assert.equal(total, 500); // c and d each owe 250
  assert.equal(bucket.net.get("a"), 450);
  assert.equal(bucket.net.get("b"), 50);
});

test("balances never mix currencies", () => {
  const buckets = computeBalances([
    dinner,
    { currency: "THB", shares: [{ userId: "a", paidCents: 100, owedCents: 0 }, { userId: "b", paidCents: 0, owedCents: 100 }] },
  ]);
  assert.deepEqual(buckets.map((b) => b.currency), ["INR", "THB"]);
});

test("simplify debts keeps every net position identical", () => {
  const net = new Map([
    ["a", 600],
    ["b", -100],
    ["c", -200],
    ["d", -300],
  ]);
  const debts = simplifyDebts(net);
  assert.ok(debts.length <= net.size - 1);

  const rebuilt = new Map<string, number>();
  for (const debt of debts) {
    rebuilt.set(debt.fromUserId, (rebuilt.get(debt.fromUserId) ?? 0) - debt.amountCents);
    rebuilt.set(debt.toUserId, (rebuilt.get(debt.toUserId) ?? 0) + debt.amountCents);
  }
  for (const [userId, value] of net) {
    assert.equal(rebuilt.get(userId) ?? 0, value, `net for ${userId}`);
  }
});

test("simplify collapses a chain into one payment", () => {
  // a owes b 100, b owes c 100  ->  a pays c 100
  const balances = computeBalances([
    {
      currency: "INR",
      shares: [
        { userId: "b", paidCents: 100, owedCents: 0 },
        { userId: "a", paidCents: 0, owedCents: 100 },
      ],
    },
    {
      currency: "INR",
      shares: [
        { userId: "c", paidCents: 100, owedCents: 0 },
        { userId: "b", paidCents: 0, owedCents: 100 },
      ],
    },
  ]);
  const simplified = simplifyDebts(balances[0].net);
  assert.deepEqual(simplified, [{ fromUserId: "a", toUserId: "c", amountCents: 100 }]);
  assert.equal(balances[0].debts.length, 2);
});

test("per-user summary splits owed and owing", () => {
  const [summary] = summariseForUser(computeBalances([dinner]), "a");
  assert.equal(summary.owedToYouCents, 600);
  assert.equal(summary.youOweCents, 0);
  assert.equal(summary.netCents, 600);
  assert.equal(summary.perPerson.length, 2);

  const [forB] = summariseForUser(computeBalances([dinner]), "b");
  assert.equal(forB.youOweCents, 300);
  assert.equal(forB.netCents, -300);
});
