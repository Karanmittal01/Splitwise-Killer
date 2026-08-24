import { test, expect, type Page } from "@playwright/test";

/**
 * Personal notes grouped by person: a section each, with the net that has
 * passed between you — and still nothing reaching a real balance.
 */

const stamp = Date.now();
const me = `notes.${stamp}@example.com`;
const dad = `dad.${stamp}@example.com`;
const mum = `mum.${stamp}@example.com`;

// A placeholder added by email has no name yet, so the app shows the part
// before the @ — that's what appears in pickers and lists.
const dadName = dad.split("@")[0];
const mumName = mum.split("@")[0];

test.describe.configure({ mode: "serial" });

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Local testing email").fill(me);
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL("**/dashboard");
}

async function addFriend(page: Page, email: string) {
  await page.goto("/friends");
  await page.getByLabel("Email or mobile number").fill(email);
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page.getByText(/was added/)).toBeVisible();
}

async function addNote(
  page: Page,
  note: { description: string; amount: string; direction: string; about?: string },
) {
  await page.goto("/notes/new");
  await page.getByRole("radio", { name: new RegExp(note.direction) }).check();
  await page.getByLabel("Description").fill(note.description);
  await page.getByLabel("Amount").fill(note.amount);
  if (note.about) {
    await page.getByLabel("Who it involved (optional)").selectOption({ label: note.about });
  }
  await page.getByRole("button", { name: "Save note" }).click();
}

test("notes about a person collect into their own section with a net", async ({ page }) => {
  await signIn(page);
  await addFriend(page, dad);

  // The four movements from a real ledger: ₹11,00,000 out, ₹6,45,412 back.
  await addNote(page, { description: "Lent for XEV 9S", amount: "400000", direction: "I gave", about: dadName });
  await page.waitForURL(/\/notes/);
  await addNote(page, { description: "TDS Payment", amount: "58000", direction: "I received", about: dadName });
  await page.waitForURL(/\/notes/);
  await addNote(page, {
    description: "YEIDA Registration",
    amount: "587412",
    direction: "I received",
    about: dadName,
  });
  await page.waitForURL(/\/notes/);
  await addNote(page, { description: "C-10", amount: "700000", direction: "I gave", about: dadName });
  await page.waitForURL(/\/notes/);

  await page.goto("/notes");

  // The running totals stay where they were, outside the per-person sections.
  await expect(page.getByText("Given away")).toBeVisible();
  await expect(page.getByText("₹11,00,000.00")).toBeVisible();
  await expect(page.getByText("₹6,45,412.00")).toBeVisible();

  // And there is now a section for the one person involved, with the net.
  const people = page.locator("section", { has: page.getByText("People (1)") });
  await expect(people.getByText(dadName)).toBeVisible();
  await expect(people.getByText("4 notes")).toBeVisible();
  await expect(people.getByText("₹4,54,588.00")).toBeVisible();
  await expect(people.getByText("you gave more")).toBeVisible();
});

test("opening a person shows only their notes and their own net", async ({ page }) => {
  await signIn(page);

  await page.goto("/notes");
  await page.getByRole("link", { name: new RegExp(dadName) }).click();
  await page.waitForURL(/\/notes\/person\//);

  await expect(page.getByText("Net between you")).toBeVisible();
  await expect(page.getByText("₹4,54,588.00")).toBeVisible();
  await expect(page.getByText("you gave more")).toBeVisible();

  // Their four notes, and the split of them.
  await expect(page.getByText("Lent for XEV 9S")).toBeVisible();
  await expect(page.getByText("C-10")).toBeVisible();
  await expect(page.getByText("₹11,00,000.00")).toBeVisible();
  await expect(page.getByText("₹6,45,412.00")).toBeVisible();
});

test("a second person gets their own section, kept apart from the first", async ({ page }) => {
  await signIn(page);
  await addFriend(page, mum);

  await addNote(page, { description: "Groceries money", amount: "3000", direction: "I gave", about: mumName });
  await page.waitForURL(/\/notes/);

  await page.goto("/notes");
  await expect(page.getByText("People (2)")).toBeVisible();

  // Mum's page carries her ₹3,000 and none of Dad's.
  await page.getByRole("link", { name: new RegExp(mumName) }).click();
  await page.waitForURL(/\/notes\/person\//);

  await expect(page.getByText("₹3,000.00").first()).toBeVisible();
  await expect(page.getByText("Lent for XEV 9S")).toHaveCount(0);
  await expect(page.getByText("₹4,54,588.00")).toHaveCount(0);
});

test("adding from a person's page comes back to it, already filled in", async ({ page }) => {
  await signIn(page);

  await page.goto("/notes");
  await page.getByRole("link", { name: new RegExp(mumName) }).click();
  await page.waitForURL(/\/notes\/person\//);
  const personUrl = page.url();

  await page.getByRole("link", { name: "+ Add a note" }).click();
  await expect(page.getByLabel("Who it involved (optional)")).toHaveValue(/.+/);

  await page.getByLabel("Description").fill("Diwali gift");
  await page.getByLabel("Amount").fill("1000");
  await page.getByRole("button", { name: "Save note" }).click();

  // Back where we started, with the new note and the updated net.
  await expect(page).toHaveURL(personUrl);
  await expect(page.getByText("Diwali gift")).toBeVisible();
  await expect(page.getByText("₹4,000.00").first()).toBeVisible();
});

test("receiving more than you gave reads the other way round", async ({ page }) => {
  await signIn(page);

  await addNote(page, {
    description: "Dad sent train fare",
    amount: "9000",
    direction: "I received",
    about: mumName,
  });
  await page.waitForURL(/\/notes/);

  await page.goto("/notes");
  await page.getByRole("link", { name: new RegExp(mumName) }).click();
  await page.waitForURL(/\/notes\/person\//);

  // Gave ₹4,000, received ₹9,000 → ₹5,000 the other way.
  await expect(page.getByText("₹5,000.00").first()).toBeVisible();
  await expect(page.getByText("you received more")).toBeVisible();
});

test("none of it reaches a real balance", async ({ page }) => {
  await signIn(page);

  // Lakhs of rupees of notes exist, and the dashboard still says nothing is owed.
  await page.goto("/dashboard");
  await expect(page.getByText("You're all settled up")).toBeVisible();
  await expect(page.getByText("Lent for XEV 9S")).toHaveCount(0);

  // The friend's real page is untouched too — no note appears as a debt.
  await page.goto("/friends");
  await page.locator("a[href^='/friends/']").filter({ hasText: dad }).click();
  await page.waitForURL(/\/friends\/[^/]+$/);
  await expect(page.getByText("₹4,54,588.00")).toHaveCount(0);
  await expect(page.getByText("Lent for XEV 9S")).toHaveCount(0);
});
