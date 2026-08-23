import { test, type Page } from "@playwright/test";

/**
 * Not assertions — this spec just walks the app as the seeded demo user and
 * captures each screen, so the UI can be reviewed at a glance.
 * Run with: npx playwright test screens
 */

const OUT = process.env.SHOT_DIR ?? "screenshots";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill("demo.alex@example.com");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
}

test("capture every screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });

  await page.goto("/");
  await page.screenshot({ path: `${OUT}/01-landing.png`, fullPage: true });

  await page.goto("/login");
  await page.screenshot({ path: `${OUT}/02-login.png` });

  await signIn(page);
  await page.screenshot({ path: `${OUT}/03-dashboard.png`, fullPage: true });

  await page.goto("/groups");
  await page.screenshot({ path: `${OUT}/04-groups.png`, fullPage: true });

  await page.getByText("Goa 2026").first().click();
  await page.waitForURL(/\/groups\/[^/]+$/);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/05-group.png`, fullPage: true });
  const groupPath = new URL(page.url()).pathname;

  await page.goto(`${groupPath}/settle`);
  await page.screenshot({ path: `${OUT}/06-settle.png`, fullPage: true });

  await page.goto(`${groupPath}/settings`);
  await page.screenshot({ path: `${OUT}/07-group-settings.png`, fullPage: true });

  await page.goto(groupPath);
  await page.getByText("Beach villa, 3 nights").first().click();
  await page.waitForURL(/\/expenses\//);
  await page.screenshot({ path: `${OUT}/08-expense.png`, fullPage: true });

  await page.goto(`/expenses/new?groupId=${groupPath.split("/").pop()}`);
  await page.getByLabel("Description").fill("Kayaking");
  await page.getByLabel("Amount").fill("2400");
  await page.getByRole("button", { name: "⚖" }).click();
  await page.screenshot({ path: `${OUT}/09-add-expense.png`, fullPage: true });

  await page.goto("/friends");
  await page.screenshot({ path: `${OUT}/10-friends.png`, fullPage: true });

  await page.goto("/activity");
  await page.screenshot({ path: `${OUT}/11-activity.png`, fullPage: true });

  await page.goto("/account");
  await page.screenshot({ path: `${OUT}/12-account.png`, fullPage: true });

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await page.screenshot({ path: `${OUT}/13-mobile-dashboard.png`, fullPage: true });
  await page.goto(groupPath);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/14-mobile-group.png`, fullPage: true });
});
