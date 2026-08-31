import { expect, test } from "@playwright/test";

const LOADER_PLAYED_KEY = "personal-site:opening-loader-played";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => window.sessionStorage.setItem(key, "true"), LOADER_PLAYED_KEY);
});

test("Ask gives the scroll-to-latest control a mobile touch target without enlarging desktop", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/ask");

  const button = page.getByRole("button", { name: "回到最新消息" });
  await expect(button).toBeAttached();
  await button.evaluate((element) => element.setAttribute("data-active", "true"));

  await expect.poll(async () => button.boundingBox()).toMatchObject({ height: 44, width: 44 });

  await page.setViewportSize({ height: 1_000, width: 1_440 });

  const desktopBox = await button.boundingBox();
  expect(desktopBox).not.toBeNull();
  expect(desktopBox?.width).toBeCloseTo(28, 1);
  expect(desktopBox?.height).toBeCloseTo(28, 1);
});
