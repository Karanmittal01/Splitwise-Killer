import test from "node:test";
import assert from "node:assert/strict";
import { groupNotesByPerson, summariseNotes, type NoteLike } from "../src/lib/notes";

const dad = "user-dad";
const mum = "user-mum";

/** The four notes from the screenshot that prompted this feature. */
const dadNotes: (NoteLike & { aboutUserId: string | null })[] = [
  { direction: "GAVE", amountCents: 40_000_000, currency: "INR", aboutUserId: dad },
  { direction: "RECEIVED", amountCents: 5_800_000, currency: "INR", aboutUserId: dad },
  { direction: "RECEIVED", amountCents: 58_741_200, currency: "INR", aboutUserId: dad },
  { direction: "GAVE", amountCents: 70_000_000, currency: "INR", aboutUserId: dad },
];

test("the net is what went out minus what came back", () => {
  const [totals] = summariseNotes(dadNotes);

  assert.equal(totals.currency, "INR");
  assert.equal(totals.gave, 110_000_000);
  assert.equal(totals.received, 64_541_200);
  assert.equal(totals.net, 45_458_800);
  assert.equal(totals.spent, 0);
});

test("money spent on nobody in particular stays out of the net", () => {
  const [totals] = summariseNotes([
    { direction: "GAVE", amountCents: 5_000, currency: "INR" },
    { direction: "RECEIVED", amountCents: 2_000, currency: "INR" },
    { direction: "SPENT", amountCents: 99_000, currency: "INR" },
  ]);

  assert.equal(totals.spent, 99_000);
  // The 99,000 is recorded but must not move the figure between two people.
  assert.equal(totals.net, 3_000);
});

test("giving and receiving the same amount comes out even", () => {
  const [totals] = summariseNotes([
    { direction: "GAVE", amountCents: 25_000, currency: "INR" },
    { direction: "RECEIVED", amountCents: 25_000, currency: "INR" },
  ]);

  assert.equal(totals.net, 0);
});

test("receiving more than you gave turns the net negative", () => {
  const [totals] = summariseNotes([
    { direction: "GAVE", amountCents: 1_000, currency: "INR" },
    { direction: "RECEIVED", amountCents: 4_500, currency: "INR" },
  ]);

  assert.equal(totals.net, -3_500);
});

test("currencies are totalled apart, never added together", () => {
  const totals = summariseNotes([
    { direction: "GAVE", amountCents: 100_000, currency: "INR" },
    { direction: "GAVE", amountCents: 5_000, currency: "USD" },
    { direction: "RECEIVED", amountCents: 2_000, currency: "USD" },
  ]);

  assert.equal(totals.length, 2);

  const inr = totals.find((row) => row.currency === "INR");
  const usd = totals.find((row) => row.currency === "USD");
  assert.equal(inr?.net, 100_000);
  assert.equal(usd?.net, 3_000);
});

test("the busiest currency is listed first", () => {
  const totals = summariseNotes([
    { direction: "GAVE", amountCents: 100, currency: "USD" },
    { direction: "GAVE", amountCents: 900_000, currency: "INR" },
  ]);

  assert.equal(totals[0].currency, "INR");
});

test("no notes means no totals rather than a row of zeroes", () => {
  assert.deepEqual(summariseNotes([]), []);
});

test("notes are bundled per person, each with their own net", () => {
  const groups = groupNotesByPerson([
    ...dadNotes,
    { direction: "GAVE", amountCents: 3_000, currency: "INR", aboutUserId: mum },
  ]);

  assert.equal(groups.length, 2);

  const forDad = groups.find((group) => group.aboutUserId === dad);
  const forMum = groups.find((group) => group.aboutUserId === mum);

  assert.equal(forDad?.notes.length, 4);
  assert.equal(forDad?.totals[0].net, 45_458_800);
  assert.equal(forMum?.notes.length, 1);
  assert.equal(forMum?.totals[0].net, 3_000);
});

test("notes that name nobody belong to no one's section", () => {
  const groups = groupNotesByPerson([
    { direction: "SPENT", amountCents: 1_000, currency: "INR", aboutUserId: null },
    { direction: "GAVE", amountCents: 2_000, currency: "INR", aboutUserId: dad },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].aboutUserId, dad);
});

test("people keep the order their notes arrived in", () => {
  // Callers pass notes newest first, so whoever you dealt with most recently
  // should come back first.
  const groups = groupNotesByPerson([
    { direction: "GAVE", amountCents: 1, currency: "INR", aboutUserId: mum },
    { direction: "GAVE", amountCents: 1, currency: "INR", aboutUserId: dad },
    { direction: "GAVE", amountCents: 1, currency: "INR", aboutUserId: mum },
  ]);

  assert.deepEqual(
    groups.map((group) => group.aboutUserId),
    [mum, dad],
  );
});
