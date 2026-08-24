import { test, expect, type Page } from "@playwright/test";

/**
 * Adding a contact detail to a friend, and merging two profiles that turn out
 * to be the same person.
 */

const stamp = Date.now();
const owner = `merger.${stamp}@example.com`;
const dupEmail = `rahul.${stamp}@example.com`;
const dupPhone = `+9197${String(stamp).slice(-8)}`;

async function signIn(page: Page, email = owner) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Local testing email").fill(email);
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL("**/dashboard");
}

/**
 * Add one person and wait for *that* add to land.
 *
 * The page keeps the previous success message on screen, so a generic
 * /was added/ matches the one before and lets the test navigate away while the
 * second add is still in flight. Every message names the handle, so wait for
 * this one's.
 */
async function addFriend(page: Page, handle: string) {
  await page.getByLabel("Email or mobile number").fill(handle);
  await page.getByRole("button", { name: "Add friend" }).click();
  // The message names them the way the app shows them — for an email that is
  // the part before the @.
  await expect(page.getByRole("status").first()).toContainText(handle.split("@")[0]);
}

async function addExpenseWith(page: Page, friendPath: string, description: string, amount: string) {
  await page.goto(friendPath);
  await page.getByRole("link", { name: "+ Add expense" }).click();
  await expect(page.getByLabel("Description")).toBeVisible();
  await page.getByLabel("Description").fill(description);
  await page.getByLabel("Amount").fill(amount);
  await page.getByRole("button", { name: "Save expense" }).click();
  await page.waitForURL(
    (url) => /^\/expenses\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"),
  );
}

test("merging two placeholder friends sums their balances into one", async ({ page }) => {
  await signIn(page);

  // Two separate placeholder friends who are really the same person: one added
  // by phone, one by email.
  await page.goto("/friends/new");
  await addFriend(page, dupPhone);
  await addFriend(page, dupEmail);

  // Two distinct friends on the list.
  await page.goto("/friends");
  await expect(page.locator("a[href^='/friends/']:not([href$='/new'])")).toHaveCount(2);

  // A ₹1,000 bill split with the phone one → they owe ₹500.
  const byPhone = page.locator("a[href^='/friends/']:not([href$='/new'])").filter({ hasText: dupPhone });
  const phonePath = (await byPhone.getAttribute("href")) ?? "";
  await addExpenseWith(page, phonePath, "Lunch", "1000");

  // A ₹600 bill split with the email one → they owe ₹300.
  await page.goto("/friends");
  const byEmail = page.locator("a[href^='/friends/']:not([href$='/new'])").filter({ hasText: dupEmail });
  const emailPath = (await byEmail.getAttribute("href")) ?? "";
  await addExpenseWith(page, emailPath, "Cab", "600");

  // On the phone friend, add the email address the other one holds → merge.
  await page.goto(phonePath);
  await page.getByRole("button", { name: /Add mobile number|Add email/ }).click();
  await page.getByLabel("Add email or mobile number").fill(dupEmail);
  await page.getByRole("button", { name: "Save", exact: true }).click();

  // The survivor is this same page, so wait for the merge to show here: both
  // expenses and the combined ₹500 + ₹300 = ₹800 balance.
  await expect(page.getByText("Cab").first()).toBeVisible();
  await expect(page.getByText("Lunch").first()).toBeVisible();
  await expect(page.getByText("₹800.00").first()).toBeVisible();

  // Both contact details survive the merge and show together in the header.
  await expect(page.getByText(dupEmail).first()).toBeVisible();
  await expect(page.getByText(dupPhone).first()).toBeVisible();

  // And the friends list has collapsed to a single person.
  await page.goto("/friends");
  await expect(page.locator("a[href^='/friends/']:not([href$='/new'])")).toHaveCount(1);
  await expect(page.getByText("₹800.00").first()).toBeVisible();
});

test("adding a brand-new detail just records it, no merge", async ({ page }) => {
  await signIn(page);
  await page.goto("/friends/new");

  const onlyPhone = `+9196${String(stamp).slice(-8)}`;
  await page.getByLabel("Email or mobile number").fill(onlyPhone);
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page.getByText(/was added/)).toBeVisible();

  await page.goto("/friends");
  const row = page.locator("a[href^='/friends/']:not([href$='/new'])").filter({ hasText: onlyPhone });
  await row.click();
  await page.waitForURL(/\/friends\/[^/]+$/);

  await page.getByRole("button", { name: /Add email/ }).click();
  await page.getByLabel("Add email or mobile number").fill(`fresh.${stamp}@example.com`);
  await page.getByRole("button", { name: "Save", exact: true }).click();

  // Recorded, not merged — the email now shows in the header subtitle.
  await expect(page.getByText(`fresh.${stamp}@example.com`)).toBeVisible();
});
