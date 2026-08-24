import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";

// Playwright doesn't read .env, and this file needs the database directly to
// pick up a confirmation token that would otherwise only exist in an inbox.
process.loadEnvFile?.(".env");

/**
 * Signing up and signing in with an email and a password, alongside Google.
 */

const stamp = Date.now();
const PASSWORD = "orange-ladder-97";

function freshEmail(tag: string): string {
  return `pw.${tag}.${stamp}@example.com`;
}

async function goToLogin(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
}

async function createAccount(page: Page, name: string, email: string, password = PASSWORD) {
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
}

async function signInWithPassword(page: Page, email: string, password: string) {
  await page.getByRole("tab", { name: "Sign in" }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("sign up with a password, then sign back in with it", async ({ page }) => {
  const email = freshEmail("basic");

  await goToLogin(page);
  await createAccount(page, "Priya Nair", email);
  await page.waitForURL("**/dashboard");

  // The account is real: the name given at sign-up is the one on it.
  await page.goto("/account");
  await expect(page.getByLabel("Display name")).toHaveValue("Priya Nair");

  // Come back as a stranger and let the password do the work.
  await goToLogin(page);
  await signInWithPassword(page, email, PASSWORD);
  await page.waitForURL("**/dashboard");
});

test("the wrong password gets you nowhere", async ({ page }) => {
  const email = freshEmail("wrong");

  await goToLogin(page);
  await createAccount(page, "Wrong Password", email);
  await page.waitForURL("**/dashboard");

  await goToLogin(page);
  await signInWithPassword(page, email, "definitely-not-it");

  await expect(page.getByText(/don't match/)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("an email that already has an account can't be signed up twice", async ({ page }) => {
  const email = freshEmail("twice");

  await goToLogin(page);
  await createAccount(page, "First Time", email);
  await page.waitForURL("**/dashboard");

  await goToLogin(page);
  await createAccount(page, "Second Time", email, "a-different-password-1");

  await expect(page.getByText(/already has an account/)).toBeVisible();
});

test("a weak password is refused, by the browser and by the server", async ({ page }) => {
  const email = freshEmail("weak");

  await goToLogin(page);
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Your name").fill("Too Weak");
  await page.getByLabel("Email", { exact: true }).fill(email);

  // Layer one: the field's own minLength stops a short password before any
  // request is made.
  const field = page.getByLabel("Password", { exact: true });
  await field.fill("short");
  await expect(field).toHaveJSProperty("validity.valid", false);

  // Layer two: something the browser is perfectly happy with — eight
  // characters — that the server still refuses. Only the server can know this.
  await field.fill("password");
  await expect(field).toHaveJSProperty("validity.valid", true);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/first anyone would try/)).toBeVisible();

  // Nothing was created either time — the same email is still free.
  await goToLogin(page);
  await createAccount(page, "Too Weak", email);
  await page.waitForURL("**/dashboard");
});

test("someone who joined with Google can add a password and then use it", async ({ page }) => {
  const email = freshEmail("google");

  // The dev sign-in stands in for Google here: it produces exactly the same
  // thing, an account with no password on it.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Local testing email").fill(email);
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL("**/dashboard");

  await page.goto("/account");
  await page.getByRole("button", { name: "Set a password" }).click();
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Repeat it").fill(PASSWORD);
  await page.getByRole("button", { name: "Set password" }).click();

  await expect(page.getByText(/Password set/)).toBeVisible();

  // Now the email and password work on their own.
  await goToLogin(page);
  await signInWithPassword(page, email, PASSWORD);
  await page.waitForURL("**/dashboard");
});

test("changing a password needs the old one", async ({ page }) => {
  const email = freshEmail("change");

  await goToLogin(page);
  await createAccount(page, "Changer", email);
  await page.waitForURL("**/dashboard");

  await page.goto("/account");
  await page.getByRole("button", { name: "Change password" }).click();

  // Wrong current password: refused.
  await page.getByLabel("Current password").fill("not-the-old-one");
  await page.getByLabel("New password").fill("second-password-42");
  await page.getByLabel("Repeat it").fill("second-password-42");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText(/current password isn't right/)).toBeVisible();

  // The two new ones have to agree.
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByLabel("New password").fill("second-password-42");
  await page.getByLabel("Repeat it").fill("mismatched-password-42");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText(/don't match/)).toBeVisible();

  // Right this time.
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByLabel("New password").fill("second-password-42");
  await page.getByLabel("Repeat it").fill("second-password-42");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed.")).toBeVisible();

  // The old password is dead, the new one works.
  await goToLogin(page);
  await signInWithPassword(page, email, PASSWORD);
  await expect(page.getByText(/don't match/)).toBeVisible();

  await goToLogin(page);
  await signInWithPassword(page, email, "second-password-42");
  await page.waitForURL("**/dashboard");
});

/** The token behind the confirmation link, straight from the database. */
async function confirmationTokenFor(email: string): Promise<string | null> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ token: string }>(
      'SELECT token FROM "VerificationToken" WHERE identifier = $1',
      [`verify-email:${email}`],
    );
    return rows[0]?.token ?? null;
  } finally {
    await client.end();
  }
}

test("signing up as an already-invited friend does not hand over their balances", async ({
  page,
}) => {
  const inviter = freshEmail("inviter");
  const invited = freshEmail("invited");

  // An inviter adds a friend by email and splits a bill with them. The friend
  // has never signed in, but a placeholder account now holds ₹500 of real
  // balance in their name.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Local testing email").fill(inviter);
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL("**/dashboard");

  await page.goto("/friends/new");
  await page.getByLabel("Email or mobile number").fill(invited);
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page.getByText(/was added/)).toBeVisible();

  await page.goto("/friends");
  const friendRow = page.locator("a[href^='/friends/']:not([href$='/new'])").filter({ hasText: invited });
  await friendRow.click();
  await page.waitForURL(/\/friends\/[^/]+$/);
  await page.getByRole("link", { name: "+ Add expense" }).click();
  await page.getByLabel("Description").fill("Dinner");
  await page.getByLabel("Amount").fill("1000");
  await page.getByRole("button", { name: "Save expense" }).click();
  await page.waitForURL(
    (url) => /^\/expenses\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"),
  );

  // Somebody who knows that address signs up as them. Whatever the server
  // replies, the one thing that must not happen is being let in.
  await goToLogin(page);
  await createAccount(page, "Not Really Them", invited);

  await expect(page.getByText(/expenses waiting on it|already added this email/)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  // And the password they chose does not open the account either.
  await goToLogin(page);
  await signInWithPassword(page, invited, PASSWORD);
  await expect(page.getByText(/don't match/)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("confirming the emailed link claims the balances that were waiting", async ({ page }) => {
  const inviter = freshEmail("host");
  const invited = freshEmail("guest");

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Local testing email").fill(inviter);
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL("**/dashboard");

  await page.goto("/friends/new");
  await page.getByLabel("Email or mobile number").fill(invited);
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page.getByText(/was added/)).toBeVisible();

  await page.goto("/friends");
  const friendRow = page.locator("a[href^='/friends/']:not([href$='/new'])").filter({ hasText: invited });
  await friendRow.click();
  await page.waitForURL(/\/friends\/[^/]+$/);
  await page.getByRole("link", { name: "+ Add expense" }).click();
  await page.getByLabel("Description").fill("Taxi");
  await page.getByLabel("Amount").fill("800");
  await page.getByRole("button", { name: "Save expense" }).click();
  await page.waitForURL(
    (url) => /^\/expenses\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"),
  );

  // The real owner signs up with a password and is held at the door.
  await goToLogin(page);
  await createAccount(page, "Real Owner", invited);
  await expect(page.getByText(/expenses waiting on it/)).toBeVisible();

  const token = await confirmationTokenFor(invited);
  expect(token, "a confirmation token should have been issued").toBeTruthy();

  // Opening the link only offers to confirm — visiting it must not be enough,
  // or a mail scanner would spend the link before its owner ever taps it.
  await page.goto(`/verify/${token}`);
  await expect(page.getByRole("heading", { name: new RegExp(invited) })).toBeVisible();
  await expect(page).toHaveURL(/\/verify\//);

  await page.getByRole("button", { name: /this is my email/i }).click();
  await page.waitForURL("**/dashboard");

  // Signed in, and holding the ₹400 half of the taxi that was waiting.
  await expect(page.getByText("₹400.00").first()).toBeVisible();

  // The link is single-use.
  await page.goto(`/verify/${token}`);
  await expect(page.getByRole("heading", { name: /expired/ })).toBeVisible();

  // And from now on the password works on its own.
  await goToLogin(page);
  await signInWithPassword(page, invited, PASSWORD);
  await page.waitForURL("**/dashboard");
});
