import { test, expect, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill("demo.alex@example.com");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
}

// A real 64x48 PNG (non-square on purpose, so the centre-crop is exercised).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAfklEQVRoge2SAQkAURSDFudCrH8Kw1wMefyBAXQsfD1NdAMWUH1FdqHeJboBC6i+IrtQ7xLdgAVUX5FdqHeJbsACqq/ILtS7RDdgAdVXZBfqXaIbsIDqK7IL9S7RDVhA9RXZhXqX6AYsoPqK7EK9S3QDFlB9RXah3iW6AY8H/IyhAOIu9yXaAAAAAElFTkSuQmCC",
  "base64",
);

test("upload, serve and remove a profile picture", async ({ page }) => {
  await signIn(page);
  await page.goto("/account");

  await expect(page.getByRole("heading", { name: "Profile picture" })).toBeVisible();
  await page.setInputFiles("#avatar-input", {
    name: "me.png",
    mimeType: "image/png",
    buffer: PNG,
  });

  await expect(page.getByText("Profile picture updated.")).toBeVisible();

  // The stored picture is served back, and it is the shrunken JPEG.
  await page.reload();
  const avatar = page.locator('img[src^="/api/avatars/"]').first();
  await expect(avatar).toBeVisible();
  const src = await avatar.getAttribute("src");
  expect(src).toContain("?v=");

  const served = await page.request.get(src!);
  expect(served.ok()).toBeTruthy();
  expect(served.headers()["content-type"]).toBe("image/jpeg");

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Profile picture removed.")).toBeVisible();
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
