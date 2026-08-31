import { expect, test, type Page } from "@playwright/test";

const LOADER_PLAYED_KEY = "personal-site:opening-loader-played";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => window.sessionStorage.setItem(key, "true"), LOADER_PLAYED_KEY);
});

async function expectNativeDocumentScroll(page: Page, key: "ArrowDown" | "PageDown" | "Space") {
  await page.evaluate(() => window.scrollTo({ behavior: "instant", top: 0 }));
  await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await page.keyboard.press(key);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
}

test("desktop list pages keep native BODY keyboard scrolling", async ({ page }) => {
  await page.setViewportSize({ height: 640, width: 1_440 });
  await page.goto("/works");

  await expect.poll(() => page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeGreaterThan(640);
  for (const key of ["PageDown", "Space", "ArrowDown"] as const) {
    await expectNativeDocumentScroll(page, key);
  }

  await page.goto("/curation");
  await expect(page.locator(".curation-home__feed")).toHaveCSS("overflow-y", "visible");
  await expectNativeDocumentScroll(page, "PageDown");
});

test("Ask keeps its dedicated desktop scroll surface", async ({ page }) => {
  await page.setViewportSize({ height: 800, width: 1_440 });
  await page.goto("/ask");

  await expect(page.locator(".ask-page")).toHaveCSS("overflow", "hidden");
  await expect(page.locator('section[aria-label="问一问"]')).toHaveCSS("overflow", "hidden");
  expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBe(800);
});

for (const path of ["/", "/ask"] as const) {
  test(`${path} mobile identity controls expose 44px touch targets`, async ({ page }) => {
    await page.setViewportSize({ height: 844, width: 390 });
    await page.goto(path);

    const controls = [
      page.getByRole("button", { name: /切换为.+主题/u }),
      page.getByRole("link", { name: "GitHub", exact: true }),
      page.getByRole("link", { name: "语雀", exact: true }),
      page.getByRole("button", { name: "关于我", exact: true }),
      page.getByRole("button", { name: "我的一天", exact: true }),
    ];

    for (const control of controls) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
}
