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

test("Ask starts the request without waiting for send motion", async ({ page }) => {
  await page.route("**/api/ask", async (route) => {
    await route.fulfill({
      body: "event: done\ndata: {}\n\n",
      contentType: "text/event-stream",
      status: 200,
    });
  });

  await page.goto("/ask");
  const input = page.getByRole("textbox", { name: "输入问题" });
  await input.focus();
  await page.waitForLoadState("networkidle");
  await input.fill("请概括你的工程实践");

  await page.evaluate(() => {
    const testWindow = window as typeof window & {
      __askMotionTiming: { clickAt: number; fetchAt: number };
    };
    const nativeFetch = window.fetch.bind(window);
    testWindow.__askMotionTiming = { clickAt: 0, fetchAt: 0 };
    window.fetch = (...args) => {
      const url = String(args[0] instanceof Request ? args[0].url : args[0]);
      if (url.includes("/api/ask")) testWindow.__askMotionTiming.fetchAt = performance.now();
      return nativeFetch(...args);
    };
    document.querySelector('button[aria-label="发送问题"]')?.addEventListener("click", () => {
      testWindow.__askMotionTiming.clickAt = performance.now();
    }, { capture: true, once: true });
  });

  await page.getByRole("button", { name: "发送问题" }).click();
  await expect.poll(() => page.evaluate(() => {
    const testWindow = window as typeof window & {
      __askMotionTiming?: { clickAt: number; fetchAt: number };
    };
    const timing = testWindow.__askMotionTiming;
    return timing?.fetchAt ? timing.fetchAt - timing.clickAt : Infinity;
  })).toBeLessThan(300);
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

  const health = await request.get("/api/health/data");
  expect(health.ok()).toBe(true);
  const healthBody = await health.json();
  expect(healthBody).toMatchObject({
    askIndex: { healthy: true, missingFts: 0, orphanFts: 0 },
    database: { healthy: true, quickCheck: "ok" },
  });
  expect(healthBody.aiNews).not.toHaveProperty("lastError");
});

test("Ask has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/ask");
  await expect(page.getByRole("main")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
