import { test, expect } from "@playwright/test";

/**
 * The home-screen icon and the launch screen.
 *
 * The artwork originally shipped as a rounded square on a white card, so every
 * phone drew a white plate around it. These check the pixels rather than the
 * file name, because "the icon is served" was already true when it looked wrong.
 */

/** Read an icon into a canvas and report its corner and edge colours. */
async function sample(page: import("@playwright/test").Page, src: string) {
  return page.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    const ctx = canvas.getContext("2d")!;
    const at = (x: number, y: number) => {
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      return { r, g, b, sat: Math.max(r, g, b) - Math.min(r, g, b) };
    };
    const w = img.width, h = img.height;
    return {
      size: w,
      corners: [at(1, 1), at(w - 2, 1), at(1, h - 2), at(w - 2, h - 2)],
      edges: [at(w >> 1, 1), at(1, h >> 1), at(w >> 1, h - 2), at(w - 2, h >> 1)],
    };
  }, src);
}

test("the icon reaches every edge — no white plate baked in", async ({ page }) => {
  await page.goto("/login");

  for (const src of ["/icon-512.png", "/icon-192.png", "/icon-maskable-512.png"]) {
    const { size, corners, edges } = await sample(page, src);
    expect(size, `${src} decoded`).toBeGreaterThan(0);

    // Every corner and edge midpoint is coloured artwork. A white card shows up
    // here as a near-grey pixel with almost no saturation.
    for (const p of [...corners, ...edges]) {
      expect(p.sat, `${src} at ${JSON.stringify(p)} should be coloured`).toBeGreaterThan(20);
      expect(Math.min(p.r, p.g, p.b), `${src} should not be near-white`).toBeLessThan(215);
    }
  }
});

test("the launch screen is a brand colour, not an off-white page", async ({ page }) => {
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();

  // Android paints background_color full-bleed while the app starts.
  expect(manifest.background_color).toBe("#0b2a3d");
  // Matching the status bar keeps it from cutting a stripe across the launch.
  expect(manifest.theme_color).toBe(manifest.background_color);
  expect(manifest.start_url).toBe("/dashboard");
});

test("maskable icons are their own files, not the same ones twice", async ({ page }) => {
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();

  const any = manifest.icons.filter((i: { purpose: string }) => i.purpose === "any");
  const maskable = manifest.icons.filter((i: { purpose: string }) => i.purpose === "maskable");
  expect(any.length).toBeGreaterThan(0);
  expect(maskable.length).toBeGreaterThan(0);

  // A launcher crops a maskable icon to its own shape, so it needs artwork with
  // a margin — which means a different file from the full-bleed one.
  const anySrcs = new Set(any.map((i: { src: string }) => i.src));
  for (const icon of maskable) {
    expect(anySrcs.has(icon.src), `${icon.src} is used for both purposes`).toBe(false);
    expect((await page.request.get(icon.src)).ok()).toBeTruthy();
  }
});

test("the home-screen icon offers the two things you open the app to do", async ({ page }) => {
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();

  const urls = manifest.shortcuts.map((s: { url: string }) => s.url);
  expect(urls).toContain("/expenses/new");
  expect(urls).toContain("/friends");
});
