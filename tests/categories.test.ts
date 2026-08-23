import test from "node:test";
import assert from "node:assert/strict";
import { category, guessCategory } from "../src/lib/categories";

const CASES: [string, string][] = [
  // Food and drink
  ["Dinner at Toit", "dining"],
  ["Swiggy order", "dining"],
  ["chai and samosa", "dining"],
  ["biryani", "dining"],
  ["milk and vegetables", "groceries"],
  ["Blinkit groceries", "groceries"],
  ["beers at the pub", "liquor"],

  // Getting around
  ["Uber to airport", "taxi"],
  ["auto rickshaw", "taxi"],
  ["IRCTC train ticket", "train"],
  ["flight to Delhi", "flight"],
  ["Petrol", "fuel"],
  ["toll and fastag", "parking"],
  ["car servicing", "car"],
  ["hotel stay Goa", "hotel"],

  // Home and bills — these are the ones full-word matching used to miss
  ["Electricity bill", "electricity"],
  ["Rent for October", "rent"],
  ["LPG cylinder", "gas"],
  ["water can", "water"],
  ["Airtel bill", "phone"],
  ["broadband renewal", "internet"],
  ["house help salary", "help"],
  ["plumber repair", "maintenance"],

  // Life
  ["Medicines from Apollo", "medical"],
  ["Haircut", "personalcare"],
  ["Gym membership", "fitness"],
  ["Amazon order", "shopping"],
  ["diapers", "childcare"],
  ["school fees", "education"],
  ["cricket match ticket", "sports"],
  ["dry cleaning", "services"],
  ["Netflix subscription", "subscriptions"],
];

test("guesses a category from the description", () => {
  for (const [description, expected] of CASES) {
    assert.equal(guessCategory(description), expected, `"${description}"`);
  }
});

test("plurals and word endings still match", () => {
  // The old full-word matching failed every one of these.
  assert.equal(guessCategory("electricity"), "electricity");
  assert.equal(guessCategory("medicines"), "medical");
  assert.equal(guessCategory("groceries"), "groceries");
  assert.equal(guessCategory("movies tonight"), "movies");
});

test("falls back to general rather than guessing wildly", () => {
  assert.equal(guessCategory(""), "general");
  assert.equal(guessCategory("   "), "general");
  assert.equal(guessCategory("random thing xyz"), "general");
  assert.equal(guessCategory("qwerty"), "general");
});

test("short keywords do not match inside longer words", () => {
  // "vi" (Vodafone Idea) must not fire on "video", "gym" not on "gymnasium
  // supplies" being read as something else, etc.
  assert.notEqual(guessCategory("video call setup"), "phone");
  assert.notEqual(guessCategory("cabbage and onions"), "taxi");
});

test("every guessed category is a real one", () => {
  for (const [description] of CASES) {
    const id = guessCategory(description);
    assert.equal(category(id).id, id, `"${description}" produced unknown category ${id}`);
  }
});
