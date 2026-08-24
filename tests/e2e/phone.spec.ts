import { test, expect, type Page } from "@playwright/test";

/** Mobile-number invites: one person however the number is typed, and a way to reach them. */
const stamp = Date.now();
const owner = `phoneowner.${stamp}@example.com`;
const local = `98${String(stamp).slice(-8)}`; // a 10-digit local number

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Local testing email").fill(email);
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL("**/dashboard");
}

test.describe.configure({ mode: "serial" });

test("the same number typed differently is one person", async ({ page }) => {
  await signIn(page, owner);

  await page.goto("/friends/new");
  await page.getByLabel("Nickname (optional)").fill("Phone Person");
  await page.getByLabel("Email or mobile number").fill(local);
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page.getByText(/was added/)).toBeVisible();

  // Same human, written the way somebody else would write it.
  await page.getByLabel("Nickname (optional)").fill("Phone Person Again");
  await page.getByLabel("Email or mobile number").fill(`+91 ${local.slice(0, 5)} ${local.slice(5)}`);
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page.getByText(/is now on your friends list|was added/)).toBeVisible();

  await page.goto("/friends");
  await expect(page.locator("a[href^='/friends/']:not([href$='/new'])")).toHaveCount(1);
});

test("a mobile invite offers WhatsApp and SMS", async ({ page }) => {
  await signIn(page, owner);
  await page.goto("/friends");
  await page.locator("a[href^='/friends/']:not([href$='/new'])").first().click();
  await page.waitForURL(/\/friends\//);

  const whatsapp = page.getByLabel(`WhatsApp +91${local}`);
  await expect(whatsapp).toBeVisible();
  const href = await whatsapp.getAttribute("href");
  // Addressed to that exact number, with the invite link in the message.
  expect(href).toContain(`wa.me/91${local}`);
  expect(decodeURIComponent(href ?? "")).toContain("/join/");

  const sms = page.getByLabel("Send as a text message");
  await expect(sms).toBeVisible();
  expect(await sms.getAttribute("href")).toContain(`sms:+91${local}`);
});
