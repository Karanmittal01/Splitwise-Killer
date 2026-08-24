import { test, expect, type Page } from "@playwright/test";

/**
 * Full-stack smoke tests: sign in, build a group, split a bill five different
 * ways, settle up, and prove an invited person walks into their balance.
 */

const stamp = Date.now();
const alex = `alex.${stamp}@example.com`;
const sam = `sam.${stamp}@example.com`;
const riya = `riya.${stamp}@example.com`;

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Local testing email").fill(email);
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL("**/dashboard");
}

async function signOut(page: Page) {
  await page.context().clearCookies();
}

test.describe.configure({ mode: "serial" });

let groupUrl = "";

test("sign in and land on an empty dashboard", async ({ page }) => {
  await signIn(page, alex);
  await expect(page.getByRole("heading", { name: /^Hi / })).toBeVisible();
  await expect(page.getByText("You're all settled up")).toBeVisible();
});

test("create a group and invite people who have no account yet", async ({ page }) => {
  await signIn(page, alex);
  await page.goto("/groups/new");
  await page.getByLabel("Group name").fill("Goa Trip");
  await page.getByLabel("Invite people").fill(`${sam}\n${riya}`);
  await page.getByRole("button", { name: "Create group" }).click();

  await page.waitForURL((url) => /^\/groups\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"));
  groupUrl = new URL(page.url()).pathname;

  await expect(page.getByRole("heading", { name: "Goa Trip" })).toBeVisible();
  await expect(page.getByText("3 members")).toBeVisible();
});

test("add an equally split expense and see the balances", async ({ page }) => {
  await signIn(page, alex);
  await page.goto(groupUrl);
  await page.getByRole("link", { name: "+ Add expense" }).click();

  await page.getByLabel("Description").fill("Beach house");
  await page.getByLabel("Amount").fill("9000");
  await expect(page.getByText("₹3,000.00 each")).toBeVisible();
  await page.getByRole("button", { name: "Save expense" }).click();

  await page.waitForURL(new RegExp(`${groupUrl}$`));
  await expect(page.getByText("Beach house")).toBeVisible();
  // Alex paid 9000 and owes 3000, so is owed 6000.
  await expect(page.getByText("Overall, you are owed")).toBeVisible();
  await expect(page.getByText("₹6,000.00").first()).toBeVisible();
});

test("split a second expense by exact amounts", async ({ page }) => {
  await signIn(page, alex);
  await page.goto(`/expenses/new?groupId=${groupUrl.split("/").pop()}`);

  await page.getByLabel("Description").fill("Dinner");
  await page.getByLabel("Amount").fill("1000");
  await page.getByRole("button", { name: "1.23" }).click();

  const inputs = page.locator('input[inputmode="decimal"]');
  // First input is the amount; the rest are the per-person exact amounts.
  await inputs.nth(1).fill("400");
  await inputs.nth(2).fill("300");
  await inputs.nth(3).fill("300");

  await page.getByRole("button", { name: "Save expense" }).click();
  await page.waitForURL(new RegExp(`${groupUrl}$`));

  // Alex is owed 6000 from the house + 600 from dinner.
  await expect(page.getByText("₹6,600.00").first()).toBeVisible();
});

test("a percentage split has to add up to 100", async ({ page }) => {
  await signIn(page, alex);
  await page.goto(`/expenses/new?groupId=${groupUrl.split("/").pop()}`);

  await page.getByLabel("Description").fill("Scooter rental");
  await page.getByLabel("Amount").fill("1200");
  await page.getByRole("button", { name: "%" }).click();

  const inputs = page.locator('input[inputmode="decimal"]');
  await inputs.nth(1).fill("50");
  await inputs.nth(2).fill("25");
  await expect(page.getByText(/Percentages must add up to 100%/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Save expense" })).toBeDisabled();

  await inputs.nth(3).fill("25");
  await expect(page.getByRole("button", { name: "Save expense" })).toBeEnabled();
  await page.getByRole("button", { name: "Save expense" }).click();
  await page.waitForURL(new RegExp(`${groupUrl}$`));
  await expect(page.getByText("Scooter rental")).toBeVisible();
});

test("settle up clears part of the balance", async ({ page }) => {
  await signIn(page, alex);
  await page.goto(`${groupUrl}/settle`);

  // Sam owes Alex: 3000 + 300 + 300 = 3600.
  await page.getByLabel("Amount").fill("3600");
  const from = page.getByLabel("Who paid");
  const to = page.getByLabel("Who received it");
  await expect(from).toBeVisible();
  await expect(to).toBeVisible();
  await page.getByRole("button", { name: "Record payment" }).click();

  await page.waitForURL(new RegExp(`${groupUrl}$`));
  await expect(page.getByText(/paid/).first()).toBeVisible();
});

test("an invited person sees their share the moment they sign in", async ({ page }) => {
  // Riya was only ever an email address until now.
  await signOut(page);
  await signIn(page, riya);

  await expect(page.getByRole("heading", { name: /^Hi / })).toBeVisible();
  await expect(page.getByText("Goa Trip").first()).toBeVisible();
  await expect(page.getByText("you owe").first()).toBeVisible();

  await page.getByText("Goa Trip").first().click();
  await page.waitForURL(/\/groups\//);
  await expect(page.getByText("Beach house").first()).toBeVisible();
  await expect(page.getByText("Overall, you owe")).toBeVisible();
});

test("expense detail shows the breakdown and takes comments", async ({ page }) => {
  await signIn(page, alex);
  await page.goto(groupUrl);
  await page.getByText("Beach house").click();
  await page.waitForURL(/\/expenses\//);

  await expect(page.getByText("Split equally")).toBeVisible();
  await expect(page.getByText("paid").first()).toBeVisible();

  await page.getByPlaceholder("Add a comment…").fill("Worth every rupee");
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.getByText("Worth every rupee")).toBeVisible();
});

test("the activity feed records what happened", async ({ page }) => {
  await signIn(page, alex);
  await page.goto("/activity");
  await expect(page.getByText(/added "Beach house"/)).toBeVisible();
  await expect(page.getByText(/recorded a payment/)).toBeVisible();
});

test("simplify debts collapses the chain", async ({ page }) => {
  await signIn(page, alex);
  await page.goto(`${groupUrl}/settings`);
  await page.getByText("Simplify debts").click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Group settings saved.")).toBeVisible();

  await page.goto(groupUrl);
  await expect(page.getByText("simplified")).toBeVisible();
});

test("CSV export downloads the ledger", async ({ page }) => {
  await signIn(page, alex);
  const response = await page.request.get(`${groupUrl}/export`);
  expect(response.ok()).toBeTruthy();
  const body = await response.text();
  expect(body).toContain("Date,Description,Category,Currency,Amount");
  expect(body).toContain("Beach house");
});
