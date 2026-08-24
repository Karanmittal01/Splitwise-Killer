import { test, expect, type Page } from "@playwright/test";

/** The batch of changes: nicknames, theme, notes, search, sharing, contacts. */

const stamp = Date.now();
const me = `batch.${stamp}@example.com`;
const mate = `mate.${stamp}@example.com`;

async function signIn(page: Page, email = me) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Local testing email").fill(email);
  await page.getByRole("button", { name: "Dev sign in" }).click();
  await page.waitForURL("**/dashboard");
}

test.describe.configure({ mode: "serial" });

test("add a friend, then give them a private nickname", async ({ page }) => {
  await signIn(page);
  await page.goto("/friends/new");

  // The field is called Nickname now, not "Their name".
  await expect(page.getByLabel("Nickname (optional)")).toBeVisible();
  await page.getByLabel("Email or mobile number").fill(mate);
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page.getByText(/was added/)).toBeVisible();

  await page.goto("/friends");
  await page.locator("a[href^='/friends/']:not([href$='/new'])").first().click();
  await page.waitForURL(/\/friends\//);

  // Rename inline via the pencil beside the name.
  await page.getByRole("button", { name: "Edit name" }).click();
  await page.getByLabel("Name for this friend").fill("Mountain Mate");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Mountain Mate").first()).toBeVisible();

  // The chosen name replaces their real name everywhere it is shown.
  await page.goto("/friends");
  await expect(page.getByText("Mountain Mate")).toBeVisible();
});

test("the nickname is private to the person who set it", async ({ page }) => {
  await signIn(page, mate);
  await page.goto("/friends");
  // The other side never sees "Mountain Mate".
  await expect(page.getByText("Mountain Mate")).toHaveCount(0);
});

test("theme can be pinned to light or dark", async ({ page }) => {
  await signIn(page);
  await page.goto("/account");

  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // It survives a reload — the choice is a cookie the server reads.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.getByRole("button", { name: "System" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
});

test("personal notes are recorded but never counted", async ({ page }) => {
  await signIn(page);

  // Start from a clean slate: no balances at all.
  await page.goto("/dashboard");
  await expect(page.getByText("You're all settled up")).toBeVisible();

  await page.goto("/notes/new");
  await page.getByLabel("Description").fill("Cash for Dad's plumber");
  await page.getByLabel("Amount").fill("2500");
  await page.getByRole("button", { name: "Save note" }).click();

  await page.waitForURL("**/notes");
  await expect(page.getByText("Cash for Dad's plumber")).toBeVisible();
  await expect(page.getByText("₹2,500.00").first()).toBeVisible();

  // The dashboard is untouched — this is the whole point of the feature.
  await page.goto("/dashboard");
  await expect(page.getByText("You're all settled up")).toBeVisible();
  await expect(page.getByText("Cash for Dad's plumber")).toHaveCount(0);
});

test("activity can be searched across the whole list", async ({ page }) => {
  await signIn(page);
  await page.goto("/expenses/new");
  await page.getByLabel("Description").fill("Kayaking in Gokarna");
  await page.getByLabel("Amount").fill("900");
  await page.getByRole("button", { name: "Save expense" }).click();
  await page.waitForURL((url) => /^\/expenses\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"));

  await page.goto("/activity");
  await expect(page.getByText(/Kayaking in Gokarna/)).toBeVisible();

  await page.getByLabel("Search activity").fill("kayak");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText(/Kayaking in Gokarna/)).toBeVisible();

  await page.getByLabel("Search activity").fill("something that does not exist");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("Nothing matches that")).toBeVisible();
});

test("a friend's transactions can be picked and shared", async ({ page }) => {
  await signIn(page);
  await page.goto("/friends");
  await page.getByText("Mountain Mate").first().click();
  await page.waitForURL(/\/friends\//);
  const friendPath = new URL(page.url()).pathname;

  // The share button only exists once there is something to share.
  await page.getByRole("link", { name: "+ Add expense" }).click();
  await expect(page.getByLabel("Description")).toBeVisible();
  await page.getByLabel("Description").fill("Trek permits");
  await page.getByLabel("Amount").fill("1200");
  await page.getByRole("button", { name: "Save expense" }).click();
  await page.waitForURL((url) => /^\/expenses\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"));

  await page.goto(friendPath);
  await page.getByRole("button", { name: /Share list/ }).click();
  await expect(page.getByRole("heading", { name: "Share transactions" })).toBeVisible();

  await expect(page.getByText("Trek permits").first()).toBeVisible();
  const whatsapp = page.getByRole("link", { name: "Send on WhatsApp" });
  const before = decodeURIComponent((await whatsapp.getAttribute("href")) ?? "");
  expect(before).toContain("Expenses with Mountain Mate");
  expect(before).toContain("Trek permits");

  // Unticking a row takes it out of the message.
  await page.getByRole("checkbox").first().uncheck();
  const after = decodeURIComponent((await whatsapp.getAttribute("href")) ?? "");
  expect(after).not.toContain("Trek permits");
});

test("the invite row is icons only", async ({ page }) => {
  await signIn(page);
  await page.goto("/friends/new");

  // Somebody who has not signed in yet — once they do, there is no invite to
  // send and the row correctly disappears.
  const pending = `+9199${String(stamp).slice(-8)}`;
  await page.getByLabel("Nickname (optional)").fill("Pending Pal");
  await page.getByLabel("Email or mobile number").fill(pending);
  await page.getByRole("button", { name: "Add friend" }).click();
  await expect(page.getByText(/was added/)).toBeVisible();

  await page.goto("/friends");
  await page.getByText("Pending Pal").first().click();
  await page.waitForURL(/\/friends\/[^/]+$/);

  // Compact icon controls, addressed to their number, with no wide block.
  const whatsapp = page.getByLabel(`WhatsApp ${pending}`);
  await expect(whatsapp).toBeVisible();
  expect(await whatsapp.getAttribute("href")).toContain(`wa.me/91${pending.replace(/\D/g, "").slice(2)}`);
  await expect(page.getByLabel("Copy invite link")).toBeVisible();
  await expect(page.getByLabel("Send as a text message")).toBeVisible();
  await expect(page.getByText("Invite link", { exact: true })).toHaveCount(0);
});

test("contacts can be imported from a vCard file", async ({ page }) => {
  await signIn(page);
  await page.goto("/friends/new");

  const vcf = [
    "BEGIN:VCARD",
    "FN:Imported Person",
    `EMAIL:imported.${stamp}@example.com`,
    "END:VCARD",
  ].join("\n");

  await expect(page.getByRole("heading", { name: "Import from your contacts" })).toBeVisible();
  await page.setInputFiles("#vcf-input", {
    name: "contacts.vcf",
    mimeType: "text/vcard",
    buffer: Buffer.from(vcf),
  });

  await expect(page.getByText("Imported Person")).toBeVisible();
  await page.getByRole("button", { name: /Add 1 person/ }).click();
  await expect(page.getByText(/1 added/)).toBeVisible();

  // And they are on the list itself, not just in the import panel.
  await page.goto("/friends");
  await expect(page.getByText("Imported Person")).toBeVisible();
});

test("the contact page takes feedback", async ({ page }) => {
  await signIn(page);
  await page.goto("/contact");

  await page.getByLabel("Message").fill("Great app, one request: dark mode on the login page.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/your message has been sent/)).toBeVisible();
});

test("the logo goes home from every corner of the app", async ({ page }) => {
  await signIn(page);
  await page.goto("/friends");
  await page.getByRole("link", { name: /Splitwise Killer/ }).first().click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: /^Hi / })).toBeVisible();
});
