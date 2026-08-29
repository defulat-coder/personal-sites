import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("Ask exposes every public search scope", async ({ page }) => {
  await page.goto("/ask");
  const scope = page.getByRole("button", { name: /检索范围/u });
  await scope.click();
  await page.getByRole("menuitemradio", { name: "关于我" }).click();
  await expect(scope).toHaveAccessibleName("检索范围：关于我");
  await scope.click();
  await page.getByRole("menuitemradio", { name: "构建" }).click();
  await expect(scope).toHaveAccessibleName("检索范围：构建");
});

test("public discovery endpoints remain machine readable", async ({ request }) => {
  for (const [path, type] of [
    ["/robots.txt", "text/plain"],
    ["/sitemap.xml", "application/xml"],
    ["/feed.xml", "application/rss+xml"],
    ["/opengraph-image", "image/png"],
  ] as const) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    expect(response.headers()["content-type"], path).toContain(type);
  }
});

test("Ask has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/ask");
  await expect(page.getByRole("main")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
