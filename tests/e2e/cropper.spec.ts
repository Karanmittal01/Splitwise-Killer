import { test, expect, type Page } from "@playwright/test";

/** A 400x200 image: left half red, right half blue. */
const WIDE = Buffer.from(
  "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",
  "base64",
);

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Local testing email").fill("demo.riya@example.com");
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL("**/dashboard");
}

/**
 * Pick a file and wait for the cropper. Against the dev server the page can
 * still be hydrating, in which case the change event lands before React has
 * attached its handler — so try once more rather than failing spuriously.
 */
async function openCropper(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Crop your picture" });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.setInputFiles("#avatar-input", {
      name: "wide.png",
      mimeType: "image/png",
      buffer: WIDE,
    });
    try {
      await dialog.waitFor({ state: "visible", timeout: 3000 });
      return dialog;
    } catch {
      await page.setInputFiles("#avatar-input", []);
    }
  }
  throw new Error("The cropper never opened");
}

test.describe.configure({ mode: "serial" });

test("picking a file opens the cropper instead of uploading straight away", async ({ page }) => {
  await signIn(page);
  await page.goto("/account");

  const dialog = await openCropper(page);
  await expect(page.getByLabel("Zoom")).toBeVisible();
  // A good image must not report a read error (React's double-invoked effect
  // used to revoke the object URL out from under the first load).
  await expect(page.getByText(/couldn't be read/)).toHaveCount(0);

  // Cancelling leaves the account untouched.
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Profile picture updated.")).toHaveCount(0);
});

test("the crop is what gets uploaded", async ({ page }) => {
  await signIn(page);
  await page.goto("/account");
  const dialog = await openCropper(page);

  // Drag the image right, which brings the red (left) half into the frame.
  const frame = dialog.locator("div.aspect-square").first();
  const box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();

  await page.getByRole("button", { name: "Use photo" }).click();
  await expect(page.getByText("Profile picture updated.")).toBeVisible();

  // The stored file is a square JPEG, not the original 400x200 PNG.
  await page.reload();
  const src = await page.locator('img[src^="/api/avatars/"]').first().getAttribute("src");
  const served = await page.request.get(src!);
  expect(served.ok()).toBeTruthy();
  expect(served.headers()["content-type"]).toBe("image/jpeg");
  const bytes = (await served.body()).length;
  expect(bytes).toBeGreaterThan(200);
  expect(bytes).toBeLessThan(200_000);

  await page.getByRole("button", { name: "Change or remove picture" }).click();
  await page.getByRole("button", { name: "Remove picture", exact: true }).click();
  await expect(page.getByText("Profile picture removed.")).toBeVisible();
});

test("the category is guessed from the description and shown", async ({ page }) => {
  await signIn(page);
  await page.goto("/expenses/new");

  const description = page.getByLabel("Description");
  await expect(description).toBeVisible();

  await description.fill("Electricity bill");
  await expect(page.getByText(/Filed under .*Electricity/)).toBeVisible();

  await description.fill("Uber to airport");
  await expect(page.getByText(/Filed under .*Taxi/)).toBeVisible();

  await description.fill("Medicines from Apollo");
  await expect(page.getByText(/Filed under .*Medical/)).toBeVisible();

  // Nothing recognisable: no claim is made.
  await description.fill("qwerty");
  await expect(page.getByText(/Filed under/)).toHaveCount(0);
});
