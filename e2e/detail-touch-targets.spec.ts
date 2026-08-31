import { expect, test, type Locator, type Page } from "@playwright/test";

const LOADER_PLAYED_KEY = "personal-site:opening-loader-played";
const MOBILE_VIEWPORT = { height: 844, width: 390 };
const DESKTOP_VIEWPORT = { height: 900, width: 1_440 };

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => window.sessionStorage.setItem(key, "true"), LOADER_PLAYED_KEY);
});

async function expectTouchTargets(controls: Locator) {
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const box = await controls.nth(index).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
}

async function expectDesktopDensity(controls: Locator) {
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const box = await controls.nth(index).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThan(44);
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
}

test("AI news detail gives the back link and original-source CTA mobile touch targets", async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto("/ai-news");
  const detailPath = await page.locator(".ai-news__entry").first().getAttribute("href");
  expect(detailPath).toMatch(/^\/ai-news\//u);
  await page.goto(detailPath!);

  const controls = page.locator(".ai-news-detail__back, .ai-news-detail__cta");
  await expectTouchTargets(controls);
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize(DESKTOP_VIEWPORT);
  await expectDesktopDensity(controls);
});

test("curation detail gives its return link a mobile touch target", async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto("/curation/2093968800316293400");

  const back = page.getByRole("link", { name: "返回每日关注" });
  await expectTouchTargets(back);
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize(DESKTOP_VIEWPORT);
  await expectDesktopDensity(back);
});

test("open-source document tabs and GitHub CTA keep sticky, dark mobile controls", async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto("/open-source/loopx");

  const tabs = page.getByRole("tab");
  const github = page.getByRole("link", { name: /在 GitHub 查看仓库/u });
  const documentHeader = page.getByRole("heading", { name: "仓库文档" }).locator("..");
  await expectTouchTargets(tabs);
  await expectTouchTargets(github);
  await expect(documentHeader).toHaveCSS("position", "sticky");
  await expect(documentHeader).toHaveCSS("border-bottom-width", "1px");

  await page.getByRole("button", { name: /切换为.+主题/u }).click();
  await expect(page.locator("html")).toHaveAttribute("data-curation-theme", "dark");
  await expectTouchTargets(tabs);
  await expectTouchTargets(github);
  await expect(documentHeader).toHaveCSS("background-color", "rgb(24, 24, 24)");
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize(DESKTOP_VIEWPORT);
  await expectDesktopDensity(tabs);
  await expectDesktopDensity(github);
});

test("works project index links are mobile touch targets without widening the page", async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto("/works/personal-site");

  const links = page.getByRole("navigation", { name: "项目档案索引" }).getByRole("link");
  await expectTouchTargets(links);
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize(DESKTOP_VIEWPORT);
  await expectDesktopDensity(links);
});
