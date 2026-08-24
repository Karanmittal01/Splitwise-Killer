import { test, expect, type Page } from "@playwright/test";

/**
 * The Friends tab holds the list and nothing else; adding people lives on its
 * own page behind the header button.
 */

const stamp = Date.now();
const me = `flist.${stamp}@example.com`;
const riya = `riya.${stamp}@example.com`;

test.describe.configure({ mode: "serial" });

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Local testing email").fill(me);
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL("**/dashboard");
}

test("the friends tab carries no add form of its own", async ({ page }) => {
  await signIn(page);
  await page.goto("/friends");

  // Nothing to fill in and nothing to import — just the way in.
  await expect(page.getByLabel("Email or mobile number")).toHaveCount(0);
  await expect(page.getByLabel("Nickname (optional)")).toHaveCount(0);
  await expect(page.getByText("Import from your contacts")).toHaveCount(0);

  await expect(page.getByRole("link", { name: "+ Add a friend" })).toBeVisible();
});

test("the empty state leads to the same page as the header button", async ({ page }) => {
  await signIn(page);
  await page.goto("/friends");

  await page.getByRole("link", { name: "Add a friend", exact: true }).click();
  await page.waitForURL("**/friends/new");
});

test("everything for adding somebody is on that one page", async ({ page }) => {
  await signIn(page);
  await page.goto("/friends");
  await page.getByRole("link", { name: "+ Add a friend" }).click();
  await page.waitForURL("**/friends/new");

  await expect(page.getByLabel("Email or mobile number")).toBeVisible();
  await expect(page.getByLabel("Nickname (optional)")).toBeVisible();
  await expect(page.getByText("Import from your contacts")).toBeVisible();
  await expect(page.getByRole("link", { name: "Friends" }).first()).toBeVisible();

  await page.getByLabel("Nickname (optional)").fill("Riya");
  await page.getByLabel("Email or mobile number").fill(riya);
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page.getByText(/was added|is now on your friends list/)).toBeVisible();

  // Stays put with the form cleared, so a second person can go straight in.
  await expect(page).toHaveURL(/\/friends\/new$/);
  await expect(page.getByLabel("Email or mobile number")).toHaveValue("");
  await expect(page.getByLabel("Nickname (optional)")).toHaveValue("");
});

test("Done goes back to the list, with the new person on it", async ({ page }) => {
  await signIn(page);
  await page.goto("/friends/new");

  await page.getByRole("link", { name: "Done" }).click();
  await page.waitForURL(/\/friends$/);

  // Exact: the email address underneath starts with "riya." too.
  await expect(page.getByText("Riya", { exact: true })).toBeVisible();
  await expect(page.getByText("settled up").first()).toBeVisible();
  await expect(page.getByText("1 person, sorted by what's outstanding.")).toBeVisible();
});
