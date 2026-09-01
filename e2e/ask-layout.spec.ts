import { expect, test } from "@playwright/test";

const LOADER_PLAYED_KEY = "personal-site:opening-loader-played";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => window.sessionStorage.setItem(key, "true"), LOADER_PLAYED_KEY);
});

test("Ask desktop surfaces share a centered 42rem axis and the composer follows the content", async ({ page }) => {
  await page.setViewportSize({ height: 1_000, width: 1_440 });
  await page.goto("/ask");

  const ask = page.locator('section[aria-label="问一问"]');
  const navigation = ask.locator(':scope > nav[aria-label="内容导航"]');
  const viewport = ask.locator('[data-slot="message-scroller-viewport"]');
  const composer = ask.locator('[data-slot="input-group"]');

  const boxes = await Promise.all([
    ask.boundingBox(),
    navigation.boundingBox(),
    viewport.boundingBox(),
    composer.boundingBox(),
  ]);
  const [askBox, navigationBox, viewportBox, composerBox] = boxes;

  expect(askBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(viewportBox).not.toBeNull();
  expect(composerBox).not.toBeNull();
  if (!askBox || !navigationBox || !viewportBox || !composerBox) return;

  expect(askBox.width).toBeCloseTo(42 * 16, 1);
  for (const box of [navigationBox, viewportBox, composerBox]) {
    expect(box.x).toBeCloseTo(askBox.x, 1);
    expect(box.width).toBeCloseTo(askBox.width, 1);
    expect(box.x + box.width).toBeCloseTo(askBox.x + askBox.width, 1);
  }
  const columnGutters = await page.evaluate(() => {
    const pageRoot = document.querySelector<HTMLElement>(".curation-home")!;
    const profile = pageRoot.querySelector<HTMLElement>(".curation-home__profile")!;
    const askSurface = pageRoot.querySelector<HTMLElement>('section[aria-label="问一问"]')!;
    const rootBox = pageRoot.getBoundingClientRect();
    const profileBox = profile.getBoundingClientRect();
    const askSurfaceBox = askSurface.getBoundingClientRect();
    const columnGap = Number.parseFloat(getComputedStyle(pageRoot).columnGap);
    return {
      left: askSurfaceBox.left - profileBox.right - columnGap,
      right: rootBox.right - askSurfaceBox.right,
    };
  });
  expect(columnGutters.left).toBeCloseTo(columnGutters.right, 1);

  // 空态内容不足一屏：组合器紧跟滚动区内容下方（form padding-top 0.75rem），
  // 不再贴视口底部。
  expect(composerBox.y - (viewportBox.y + viewportBox.height)).toBeCloseTo(12, 1);
  expect(1_000 - composerBox.y - composerBox.height).toBeGreaterThan(100);
});

test("Ask mobile keeps its compact gutter and the composer follows the content", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/ask");

  const ask = page.locator('section[aria-label="问一问"]');
  const viewport = ask.locator('[data-slot="message-scroller-viewport"]');
  const composer = ask.locator('[data-slot="input-group"]');
  const [askBox, viewportBox, composerBox] = await Promise.all([
    ask.boundingBox(),
    viewport.boundingBox(),
    composer.boundingBox(),
  ]);

  expect(askBox).not.toBeNull();
  expect(viewportBox).not.toBeNull();
  expect(composerBox).not.toBeNull();
  if (!askBox || !viewportBox || !composerBox) return;

  expect(askBox.width).toBeCloseTo(390, 1);
  expect(viewportBox.x).toBeCloseTo(16, 1);
  expect(composerBox.x).toBeCloseTo(viewportBox.x, 1);
  expect(composerBox.width).toBeCloseTo(viewportBox.width, 1);
  // 空态内容不足一屏：组合器紧跟滚动区内容下方（form padding-top 0.75rem）。
  expect(composerBox.y - (viewportBox.y + viewportBox.height)).toBeCloseTo(12, 1);
  expect(composerBox.y + composerBox.height).toBeLessThan(844);
  await expect(page.getByRole("textbox", { name: "输入问题" })).toBeVisible();
});
