import test from "node:test";
import assert from "node:assert/strict";
import {
  centsToDecimalString,
  parseMoneyToCents,
  splitByWeights,
  splitEvenly,
} from "../src/lib/money";

test("parses everyday amount formats", () => {
  assert.equal(parseMoneyToCents("1234.56"), 123456);
  assert.equal(parseMoneyToCents("1,234.56"), 123456);
  assert.equal(parseMoneyToCents("₹1,234"), 123400);
  assert.equal(parseMoneyToCents("1.234,56"), 123456); // European style
  assert.equal(parseMoneyToCents("1,5"), 150);
  assert.equal(parseMoneyToCents("1,500"), 150000);
  assert.equal(parseMoneyToCents("0.1"), 10);
  assert.ok(Number.isNaN(parseMoneyToCents("")));
  assert.ok(Number.isNaN(parseMoneyToCents("abc")));
});

test("respects zero-decimal currencies", () => {
  assert.equal(parseMoneyToCents("1200", "JPY"), 1200);
  assert.equal(centsToDecimalString(1200, "JPY"), "1200");
  assert.equal(centsToDecimalString(1200, "INR"), "12.00");
});

test("round-trips through the decimal string", () => {
  for (const cents of [0, 1, 99, 100, 12345, 999999]) {
    assert.equal(parseMoneyToCents(centsToDecimalString(cents)), cents);
  }
});

test("splitEvenly always sums back to the total", () => {
  for (const total of [100, 101, 1000, 3333, 7]) {
    for (const count of [1, 2, 3, 4, 7]) {
      const parts = splitEvenly(total, count);
      assert.equal(parts.length, count);
      assert.equal(
        parts.reduce((a, b) => a + b, 0),
        total,
        `${total}/${count}`,
      );
      assert.ok(Math.max(...parts) - Math.min(...parts) <= 1);
    }
  }
});

test("splitByWeights distributes the remainder without losing cents", () => {
  assert.deepEqual(splitByWeights(1000, [1, 1]), [500, 500]);
  assert.equal(
    splitByWeights(1000, [1, 1, 1]).reduce((a, b) => a + b, 0),
    1000,
  );
  assert.equal(
    splitByWeights(10000, [3333, 3333, 3334]).reduce((a, b) => a + b, 0),
    10000,
  );
});
