import { test, expect, type Page } from "@playwright/test";

const stamp = Date.now();

// `next dev` floats its overlay button in the bottom-left corner, which at
// phone width lands right on top of the Home tab and swallows the click. It
// doesn't exist in a production build, so hide it rather than clicking through.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = "nextjs-portal { display: none !important; }";
    document.addEventListener("DOMContentLoaded", () => document.head.append(style));
  });
});

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(`mnav.${stamp}@example.com`);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
}

test("phone users can reach notes, account and contact from the top-bar menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);

  // These are not in the bottom bar; they must be reachable via the menu.
  const menu = page.getByRole("button", { name: "Menu" });
  await expect(menu).toBeVisible();

  await menu.click();
  await page.getByRole("menuitem", { name: /Personal notes/ }).click();
  await page.waitForURL("**/notes");
  await expect(page.getByRole("heading", { name: "Personal notes" })).toBeVisible();

  await menu.click();
  await page.getByRole("menuitem", { name: /Contact/ }).click();
  await page.waitForURL("**/contact");
  await expect(page.getByRole("heading", { name: /Contact/ })).toBeVisible();

  await menu.click();
  await page.getByRole("menuitem", { name: /Account/ }).click();
  await page.waitForURL("**/account");
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
});

test("the bottom bar still covers the five core screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  const bar = page.locator("nav.fixed");
  // Assert on the destination URL: page headings repeat in the sidebar/nav, so
  // matching on them is ambiguous.
  for (const [label, path] of [
    ["Groups", "/groups"],
    ["Friends", "/friends"],
    ["Activity", "/activity"],
    ["Home", "/dashboard"],
  ] as const) {
    await bar.getByRole("link", { name: new RegExp(label) }).click();
    await page.waitForURL(`**${path}`);
    await expect(page.locator("main")).toBeVisible();
  }
});
