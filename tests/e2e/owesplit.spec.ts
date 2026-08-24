import { test, expect, type Page } from "@playwright/test";

/**
 * The four one-on-one options: who owes what, said in words rather than
 * assembled from a payer dropdown, a split method and a pair of numbers.
 */

const stamp = Date.now();
const me = `owes.${stamp}@example.com`;
const kunal = `kunal.${stamp}@example.com`;

test.describe.configure({ mode: "serial" });

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Local testing email").fill(me);
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL("**/dashboard");
}

async function openKunal(page: Page) {
  await page.goto("/friends");
  await page.locator("a[href^='/friends/']:not([href$='/new'])").filter({ hasText: "Kunal" }).click();
  await page.waitForURL(/\/friends\/[^/]+$/);
}

/** Start an expense with Kunal from his own page. */
async function newExpense(page: Page, description: string, amount: string) {
  await openKunal(page);
  await page.getByRole("link", { name: "+ Add expense" }).click();
  await expect(page.getByLabel("Description")).toBeVisible();
  await page.getByLabel("Description").fill(description);
  await page.getByLabel("Amount").fill(amount);
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Save expense" }).click();
  await page.waitForURL(
    (url) => /^\/expenses\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"),
  );
}

test("the four options replace the split tabs for a one-on-one", async ({ page }) => {
  await signIn(page);

  await page.goto("/friends/new");
  await page.getByLabel("Nickname (optional)").fill("Kunal");
  await page.getByLabel("Email or mobile number").fill(kunal);
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page.getByText(/was added/)).toBeVisible();

  await newExpense(page, "Rent", "1000");

  // Four options, in plain words, and no cryptic tab row.
  await expect(page.getByRole("button", { name: /Kunal owes the entire amount/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Split equally · Kunal paid/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Split equally · I paid/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /I owe Kunal the entire amount/ })).toBeVisible();

  await expect(page.getByRole("button", { name: "1.23", exact: true })).toHaveCount(0);
  await expect(page.getByText("Paid by")).toHaveCount(0);

  // Each option spells out the consequence against the amount typed.
  await expect(page.getByText("Kunal owes you ₹1,000.00")).toBeVisible();
  await expect(page.getByText("₹500.00 each — you owe Kunal ₹500.00")).toBeVisible();
  await expect(page.getByText("you owe Kunal ₹1,000.00")).toBeVisible();
});

test("I owe him the entire amount", async ({ page }) => {
  await signIn(page);
  await newExpense(page, "Borrowed for the deposit", "33000");

  await page.getByRole("button", { name: /I owe Kunal the entire amount/ }).click();
  await save(page);

  // The whole ₹33,000 sits on me; Kunal owes nothing.
  await expect(page.getByText("₹33,000.00").first()).toBeVisible();

  await openKunal(page);
  await expect(page.getByText(new RegExp(`You owe .*${"₹33,000.00"}`))).toBeVisible();
});

test("Kunal owes the entire amount", async ({ page }) => {
  await signIn(page);
  await newExpense(page, "Covered his ticket", "3000");

  await page.getByRole("button", { name: /Kunal owes the entire amount/ }).click();
  await save(page);

  // ₹33,000 out, ₹3,000 back → ₹30,000 still owed.
  await openKunal(page);
  await expect(page.getByText(new RegExp(`You owe .*${"₹30,000.00"}`))).toBeVisible();
});

test("split equally, whoever paid", async ({ page }) => {
  await signIn(page);

  await newExpense(page, "Dinner, he paid", "1000");
  await page.getByRole("button", { name: /Split equally · Kunal paid/ }).click();
  await save(page);

  // I owe another ₹500 → ₹30,500.
  await openKunal(page);
  await expect(page.getByText(new RegExp(`You owe .*${"₹30,500.00"}`))).toBeVisible();

  await newExpense(page, "Lunch, I paid", "800");
  await page.getByRole("button", { name: /Split equally · I paid/ }).click();
  await save(page);

  // He owes me ₹400 back → ₹30,100.
  await openKunal(page);
  await expect(page.getByText(new RegExp(`You owe .*${"₹30,100.00"}`))).toBeVisible();
});

test("the old controls are still there behind Something else", async ({ page }) => {
  await signIn(page);
  await newExpense(page, "Odd split", "900");

  await page.getByRole("button", { name: "Something else…" }).click();

  await expect(page.getByText("Paid by")).toBeVisible();
  await expect(page.getByRole("button", { name: "%", exact: true })).toBeVisible();

  // A 70/30 split, which none of the four options can say.
  await page.getByRole("button", { name: "%", exact: true }).click();
  const shares = page.locator("input.field.w-28");
  await shares.first().fill("30");
  await shares.last().fill("70");
  await save(page);

  // I owed ₹30,100 and just took on ₹270 of a bill Kunal did not pay for...
  // I paid, so he owes me ₹630 → ₹29,470.
  await openKunal(page);
  await expect(page.getByText(new RegExp(`You owe .*${"₹29,470.00"}`))).toBeVisible();
});

test("editing an expense reopens on the option it was saved with", async ({ page }) => {
  await signIn(page);
  await openKunal(page);

  await page.getByText("Borrowed for the deposit").first().click();
  await page.waitForURL(/\/expenses\/[^/]+$/);
  await page.getByRole("link", { name: /Edit/ }).click();
  await page.waitForURL(/\/expenses\/[^/]+\/edit$/);

  const chosen = page.getByRole("button", { name: /I owe Kunal the entire amount/ });
  await expect(chosen).toHaveAttribute("aria-pressed", "true");
});
