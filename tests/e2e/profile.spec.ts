import { test, expect, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill("demo.alex@example.com");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
}

// Uploading itself is covered in cropper.spec.ts, which drives the crop
// dialog end to end. This one guards the layout of the account page.
test("the profile picture lives in the identity card, not its own section", async ({ page }) => {
  await signIn(page);
  await page.goto("/account");

  await expect(page.getByRole("heading", { name: "Profile picture" })).toHaveCount(0);

  // One card holding the avatar, the name, the email and the edit control.
  const card = page.locator("div.card").filter({ hasText: "demo.alex@example.com" }).first();
  await expect(card).toBeVisible();
  await expect(card.getByLabel("Add a picture")).toBeVisible();
  await expect(card.locator("#avatar-input")).toHaveCount(1);

  // Exactly one avatar on the page for the signed-in person.
  await expect(page.locator("#avatar-input")).toHaveCount(1);
});

test("the amount field gets the room, currency is just the symbol", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/expenses/new");

  const amount = page.getByLabel("Amount");
  // Wait for the real form: goto resolves while the loading skeleton is up.
  await expect(amount).toBeVisible();
  const box = await amount.boundingBox();
  // On a 390px phone the amount input should be the widest control in its row.
  expect(box!.width).toBeGreaterThan(180);

  // Currency is still a real select, but a narrow one showing just the symbol.
  const currency = page.locator('select[aria-label="Currency"]');
  await expect(currency).toHaveValue("INR");
  const currencyBox = await currency.boundingBox();
  expect(currencyBox!.width).toBeLessThan(90);
  expect(box!.width).toBeGreaterThan(currencyBox!.width * 2);

  // The date moved to its own row rather than squeezing the amount.
  const dateBox = await page.getByLabel("Date").boundingBox();
  expect(dateBox!.y).toBeGreaterThan(box!.y);
});

test("the brand icon is the uploaded artwork", async ({ page }) => {
  await page.goto("/login");
  const mark = page.locator('img[src="/icon-192.png"]').first();
  await expect(mark).toBeVisible();
  const res = await page.request.get("/icon-192.png");
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["content-type"]).toContain("image/png");
});
