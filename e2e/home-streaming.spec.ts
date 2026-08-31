import { expect, test } from "@playwright/test";

const profileMarkup = /<aside[^>]*class="curation-home__profile"[^>]*>/gu;
const dotFieldMarkup = /<div[^>]*class="interactive-dot-field"[^>]*>/gu;

test("home streams every legacy view through one stable profile shell", async ({ request }) => {
  for (const path of ["/", "/?view=ai-news", "/?view=daily", "/?view=open-source"]) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    const html = await response.text();
    expect(html.match(profileMarkup) ?? [], `${path} profile markup`).toHaveLength(1);
    expect(html.match(dotFieldMarkup) ?? [], `${path} dot field markup`).toHaveLength(1);
    expect(html).toContain("正在读取");
  }
});

test("mobile home and legacy views keep their distinct layout semantics", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });

  await page.goto("/");
  await expect(page.locator(".opening-loader")).toHaveCount(0);
  await expect(page.locator(".curation-home")).toHaveClass(/curation-home--mobile-home/u);
  await expect(page.locator(".curation-home__feed")).toBeHidden();
  await expect(page.locator(".interactive-dot-field")).toBeVisible();
  await expect(page.locator('nav[aria-label="内容导航"]:visible').getByRole("link", { name: "首页" })).toHaveAttribute("aria-current", "page");

  for (const [view, label] of [
    ["ai-news", "每日动态"],
    ["daily", "每日关注"],
    ["open-source", "开源关注"],
  ] as const) {
    await page.goto(`/?view=${view}`);
    await expect(page.locator(".curation-home")).not.toHaveClass(/curation-home--mobile-home/u);
    await expect(page.locator(".curation-home__feed")).toBeVisible();
    await expect(page.locator(".interactive-dot-field")).toBeHidden();
    await expect(page.locator('nav[aria-label="内容导航"]:visible').getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  }

  await page.goto("/?view=unknown");
  await expect(page.locator(".curation-home")).toHaveClass(/curation-home--mobile-home/u);
  await expect(page.locator(".curation-home__feed")).toBeHidden();

  await page.goto("/?view=daily&view=open-source");
  await expect(page.locator('nav[aria-label="内容导航"]:visible').getByRole("link", { name: "每日关注" })).toHaveAttribute("aria-current", "page");
});
