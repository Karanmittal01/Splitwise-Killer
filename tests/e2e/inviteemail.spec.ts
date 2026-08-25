import { test, expect, type Page } from "@playwright/test";

/**
 * The ✉️ on a pending friend's page sends the invite from the server, rather
 * than opening your own mail app with a draft to write.
 */

const stamp = Date.now();
const me = `inviter.${stamp}@example.com`;
const pal = `pal.${stamp}@example.com`;
const byPhone = `+9195${String(stamp).slice(-8)}`;

test.describe.configure({ mode: "serial" });

async function signIn(page: Page, email = me) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Local testing email").fill(email);
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL("**/dashboard");
}

async function addFriend(page: Page, handle: string, nickname: string) {
  await page.goto("/friends/new");
  await page.getByLabel("Nickname (optional)").fill(nickname);
  await page.getByLabel("Email or mobile number").fill(handle);
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page.getByRole("status").first()).toContainText(nickname);
}

async function openFriend(page: Page, nickname: string) {
  await page.goto("/friends");
  await page
    .locator("a[href^='/friends/']:not([href$='/new'])")
    .filter({ hasText: nickname })
    .click();
  await page.waitForURL(/\/friends\/[^/]+$/);
}

test("the envelope is a send button, not a mailto link", async ({ page }) => {
  await signIn(page);
  await addFriend(page, pal, "Pal");
  await openFriend(page, "Pal");

  const envelope = page.getByLabel(`Email the invite to ${pal}`);
  await expect(envelope).toBeVisible();

  // The distinction that matters: a button the server handles, not an anchor
  // that hands a half-written draft to the mail app.
  expect(await envelope.evaluate((el) => el.tagName)).toBe("BUTTON");
  await expect(page.locator(`a[href^="mailto:"]`)).toHaveCount(0);
});

test("tapping it sends from the server and says what happened", async ({ page }) => {
  await signIn(page);
  await openFriend(page, "Pal");

  await page.getByLabel(`Email the invite to ${pal}`).click();

  // Either outcome proves the round trip, and both wordings are pinned. Which
  // one you get depends on the mail config this suite runs against: point
  // RESEND_API_URL at a stub and it is the first, run it against a key that
  // rejects @example.com and it is the second. What matters here is that the
  // server answered — not that a stranger's inbox exists.
  await expect(page.getByRole("status").first()).toHaveText(
    new RegExp(`Invite emailed to ${pal}\\.|The email couldn't be sent`),
  );
});

test("it stops after a few taps rather than mailing them repeatedly", async ({ page }) => {
  await signIn(page);
  await openFriend(page, "Pal");

  const envelope = page.getByLabel(`Email the invite to ${pal}`);
  for (let i = 0; i < 4; i += 1) {
    await envelope.click();
    await expect(envelope).toBeEnabled();
  }

  await expect(page.getByText(/emailed a few times already/)).toBeVisible();
});

test("somebody invited by number has no address to email", async ({ page }) => {
  await signIn(page);
  await addFriend(page, byPhone, "Number Only");
  await openFriend(page, "Number Only");

  // No envelope at all — WhatsApp, SMS and the link are the ways in.
  await expect(page.getByLabel(/^Email/)).toHaveCount(0);
  await expect(page.getByLabel(`WhatsApp ${byPhone}`)).toBeVisible();
  await expect(page.getByLabel("Copy invite link")).toBeVisible();
});

test("once they sign in, there is nothing left to invite them to", async ({ page }) => {
  // Pal claims the account by signing in with the same address.
  await signIn(page, pal);

  await signIn(page);
  await openFriend(page, "Pal");

  // The whole invite block is gone, envelope included.
  await expect(page.getByText(/hasn't signed in yet/)).toHaveCount(0);
  await expect(page.getByLabel(`Email the invite to ${pal}`)).toHaveCount(0);
});
