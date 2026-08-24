import { test, expect, type Page } from "@playwright/test";

/**
 * Uploading a picture for somebody on your friends list.
 *
 * Most people here have never signed in, so they have no picture of their own
 * and show as two letters on a coloured circle. A picture you set is private to
 * you, exactly like a nickname.
 */

const stamp = Date.now();
const me = `photo.${stamp}@example.com`;
const other = `nosy.${stamp}@example.com`;
const dad = `dadpic.${stamp}@example.com`;
const dadName = dad.split("@")[0];

test.describe.configure({ mode: "serial" });

// A 2x2 red PNG — small enough to paste inline, real enough for the cropper.
const RED_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYEJRIAAADgAAxwl4G4AAAAASUVORK5CYII=";

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Local testing email").fill(email);
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL("**/dashboard");
}

async function openDad(page: Page) {
  await page.goto("/friends");
  await page.locator("a[href^='/friends/']:not([href$='/new'])").filter({ hasText: dad }).click();
  await page.waitForURL(/\/friends\/[^/]+$/);
}

/** Pick a file and push it through the cropper. */
async function uploadPhoto(page: Page) {
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "dad.png", mimeType: "image/png", buffer: Buffer.from(RED_PNG, "base64") });

  const confirm = page.getByRole("button", { name: "Use photo" });
  await expect(confirm).toBeEnabled();
  await confirm.click();
}

test("a friend with no picture of their own can be given one", async ({ page }) => {
  await signIn(page, me);

  await page.goto("/friends/new");
  await page.getByLabel("Email or mobile number").fill(dad);
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page.getByText(/was added/)).toBeVisible();

  await openDad(page);

  // Initials on a circle to begin with — no <img> for them anywhere.
  await expect(page.getByRole("button", { name: new RegExp(`Set a picture for`) })).toBeVisible();

  await uploadPhoto(page);
  await expect(page.getByText(/Only you can see it/)).toBeVisible();

  // Their avatar is now a real image, served from the private route. Checked
  // after a reload so it's the server's copy, not the local preview.
  await page.reload();
  await expect(page.locator("img[src*='/api/avatars/friend/']").first()).toBeVisible();
});

test("the picture follows them onto every other screen", async ({ page }) => {
  await signIn(page, me);

  // Friends list.
  await page.goto("/friends");
  await expect(page.locator("img[src*='/api/avatars/friend/']").first()).toBeVisible();

  // And into personal notes, where recognising people at a glance is the point.
  await page.goto("/notes/new");
  await page.getByLabel("Description").fill("Cash for the plumber");
  await page.getByLabel("Amount").fill("2500");
  await page.getByLabel("Who it involved (optional)").selectOption({ label: dadName });
  await page.getByRole("button", { name: "Save note" }).click();
  await page.waitForURL(/\/notes/);

  await page.goto("/notes");
  await expect(page.locator("img[src*='/api/avatars/friend/']").first()).toBeVisible();
});

test("the picture is private — nobody else can fetch it", async ({ page }) => {
  await signIn(page, me);
  await page.goto("/friends");
  const src = await page.locator("img[src*='/api/avatars/friend/']").first().getAttribute("src");
  expect(src).toBeTruthy();

  // A different signed-in account asking for the same URL gets nothing: it is
  // scoped to whoever uploaded it, not merely to "signed in".
  await signIn(page, other);
  const response = await page.request.get(src!);
  expect(response.status()).toBe(404);

  // And signed out entirely.
  await page.context().clearCookies();
  const anonymous = await page.request.get(src!);
  expect(anonymous.status()).toBe(401);
});

test("the picture can be removed again", async ({ page }) => {
  await signIn(page, me);
  await openDad(page);

  await page.getByRole("button", { name: /Set a picture for/ }).click();
  await page.getByRole("button", { name: "Remove picture" }).click();
  await expect(page.getByText("Picture removed.")).toBeVisible();

  await page.goto("/friends");
  await expect(page.locator("img[src*='/api/avatars/friend/']")).toHaveCount(0);
});
