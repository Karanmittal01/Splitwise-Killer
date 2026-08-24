import { test, expect, type Page } from "@playwright/test";

/**
 * The parts that are easy to get wrong: claiming an invite merges a
 * placeholder account into a real one, multi-payer expenses, one-on-one
 * expenses with somebody added mid-form, and receipt uploads.
 */

const stamp = Date.now();
const owner = `owner.${stamp}@example.com`;
const invitee = `invitee.${stamp}@example.com`;
const phoneFriend = `+9198${String(stamp).slice(-8)}`;

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Local testing email").fill(email);
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL("**/dashboard");
}

test.describe.configure({ mode: "serial" });

let inviteUrl = "";

test("add a friend by mobile number and split with them", async ({ page }) => {
  await signIn(page, owner);

  await page.goto("/friends");
  await page.getByLabel("Nickname (optional)").fill("Phone Friend");
  await page.getByLabel("Email or mobile number").fill(phoneFriend);
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page.getByText(/was added|is now on your friends list/)).toBeVisible();

  await page.getByText("Phone Friend").first().click();
  await page.waitForURL(/\/friends\//);

  // The invite link is the only way a phone-only invitee can claim their share.
  // It now rides inside the share icons rather than a visible text field.
  const whatsapp = page.getByLabel(`WhatsApp ${phoneFriend}`);
  await expect(whatsapp).toBeVisible();
  const text = decodeURIComponent((await whatsapp.getAttribute("href")) ?? "");
  inviteUrl = text.match(/https?:\/\/\S*\/join\/\S+/)?.[0] ?? "";
  expect(inviteUrl).toContain("/join/");

  // Split a bill with them outside any group.
  await page.getByRole("link", { name: "+ Add expense" }).click();
  await page.getByLabel("Description").fill("Cab to airport");
  await page.getByLabel("Amount").fill("800");
  await page.getByRole("button", { name: "Save expense" }).click();
  await page.waitForURL((url) => /^\/expenses\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"));
  await expect(page.getByText("You lent")).toBeVisible();
  await expect(page.getByText("₹400.00").first()).toBeVisible();
});

test("claiming the invite hands the balance to a real account", async ({ page }) => {
  await signIn(page, invitee);

  // Brand new account: nothing on the dashboard yet.
  await expect(page.getByText("You're all settled up")).toBeVisible();

  await page.goto(new URL(inviteUrl).pathname);
  await expect(page.getByRole("heading", { name: /added you/ })).toBeVisible();
  await page.getByRole("button", { name: /^Accept as/ }).click();
  await page.waitForURL("**/dashboard");

  // The 400 they owed as a placeholder is now theirs.
  await expect(page.getByText("you owe").first()).toBeVisible();
  await expect(page.getByText("₹400.00").first()).toBeVisible();
});

test("the inviter still sees exactly one person, now a real account", async ({ page }) => {
  await signIn(page, owner);
  await page.goto("/friends");

  const rows = page.locator("a[href^='/friends/']");
  await expect(rows).toHaveCount(1);
  await expect(page.getByText("₹400.00").first()).toBeVisible();
  await expect(page.getByText("invited")).toHaveCount(0);
});

test("an expense can have more than one payer", async ({ page }) => {
  await signIn(page, owner);
  await page.goto("/friends");
  await page.locator("a[href^='/friends/']").first().click();
  await page.getByRole("link", { name: "+ Add expense" }).click();

  await page.getByLabel("Description").fill("Weekend groceries");
  await page.getByLabel("Amount").fill("1000");
  await page.getByLabel("More than one person paid").check();

  // Scope to the "Paid by" card — the amount field shares the 0.00 placeholder.
  const paidBy = page.locator("section", { has: page.getByText("Paid by") });
  const payerInputs = paidBy.locator('input[placeholder="0.00"]');
  await payerInputs.nth(0).fill("600");
  await payerInputs.nth(1).fill("400");
  await expect(page.getByText("balanced")).toBeVisible();

  await page.getByRole("button", { name: "Save expense" }).click();
  await page.waitForURL((url) => /^\/expenses\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"));

  // Owner paid 600 and owes 500, so is up 100 on this one.
  await expect(page.getByText("You lent")).toBeVisible();
  await expect(page.getByText("₹100.00")).toBeVisible();
});

test("a receipt can be attached and viewed", async ({ page }) => {
  await signIn(page, owner);
  await page.goto("/expenses/new");

  await page.getByLabel("Description").fill("Coffee run");
  await page.getByLabel("Amount").fill("250");
  await page.getByRole("button", { name: "More options" }).click();

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel(/^Receipt/).setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: png,
  });

  await page.getByRole("button", { name: "Save expense" }).click();
  await page.waitForURL((url) => /^\/expenses\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"));
  await expect(page.getByRole("img", { name: "Receipt" })).toBeVisible();
});

test("a recurring expense schedules its next occurrence", async ({ page }) => {
  await signIn(page, owner);
  await page.goto("/expenses/new");

  await page.getByLabel("Description").fill("Netflix");
  await page.getByLabel("Amount").fill("649");
  await page.getByRole("button", { name: "More options" }).click();
  await page.getByLabel("Repeat").selectOption("MONTHLY");
  await page.getByRole("button", { name: "Save expense" }).click();

  await page.waitForURL((url) => /^\/expenses\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"));
  await expect(page.getByText("Every month")).toBeVisible();
});

test("you cannot be dropped from a group while you owe money", async ({ page }) => {
  await signIn(page, owner);
  await page.goto("/groups/new");
  await page.getByLabel("Group name").fill("Leaving test");
  await page.getByLabel("Invite people").fill(`someone.${stamp}@example.com`);
  await page.getByRole("button", { name: "Create group" }).click();
  await page.waitForURL((url) => /^\/groups\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"));
  const groupPath = new URL(page.url()).pathname;

  await page.getByRole("link", { name: "+ Add expense" }).click();
  await page.getByLabel("Description").fill("Shared thing");
  await page.getByLabel("Amount").fill("500");
  await page.getByRole("button", { name: "Save expense" }).click();
  await page.waitForURL(new RegExp(`${groupPath}$`));

  await page.goto(`${groupPath}/settings`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Leave" }).click();
  await expect(page.getByText(/still has a balance in this group/)).toBeVisible();
});
