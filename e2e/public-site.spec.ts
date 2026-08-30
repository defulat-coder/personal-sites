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

test("section navigation uses Motion SDK and cleans its final state", async ({ page }) => {
  await page.goto("/curation");
  await page.evaluate(() => {
    const testWindow = window as typeof window & { __sectionMotionDurations: number[] };
    const nativeAnimate = Element.prototype.animate;
    testWindow.__sectionMotionDurations = [];
    Element.prototype.animate = function animate(keyframes, options) {
      if (this instanceof HTMLElement && this.classList.contains("site-section-motion")) {
        const duration = typeof options === "number" ? options : options?.duration;
        if (typeof duration === "number") testWindow.__sectionMotionDurations.push(duration);
      }
      return nativeAnimate.call(this, keyframes, options);
    };
  });

  await page.getByRole("link", { name: "设计收藏" }).click();
  await expect(page).toHaveURL(/\/design$/u);
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __sectionMotionDurations?: number[] }
  ).__sectionMotionDurations ?? [])).toEqual([130, 320]);
  await expect.poll(() => page.locator(".site-section-motion").evaluate((element) => ({
    opacity: (element as HTMLElement).style.opacity,
    transform: (element as HTMLElement).style.transform,
  }))).toEqual({ opacity: "", transform: "" });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    (window as typeof window & { __sectionMotionDurations: number[] }).__sectionMotionDurations = [];
  });
  await page.getByRole("link", { name: "每日关注" }).click();
  await expect(page).toHaveURL(/\/curation$/u);
  expect(await page.evaluate(() => (
    window as typeof window & { __sectionMotionDurations?: number[] }
  ).__sectionMotionDurations ?? [])).toEqual([]);
});

test("about receipt uses Motion and keeps a reduced-motion final state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "关于我" }).click();
  const modal = page.getByRole("dialog", { name: "关于我：个人经历打印稿" });
  const paper = modal.locator(".about-printer__paper");
  await expect(modal.getByRole("status")).toHaveText("正在打印个人经历…");
  await expect.poll(() => paper.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");
  await modal.getByRole("button", { name: "关闭" }).click();
  await expect(modal).toBeHidden();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const reducedModal = page.getByRole("dialog", { name: "关于我：个人经历打印稿" });
  await expect.poll(async () => {
    if (await reducedModal.count()) return true;
    await page.getByRole("button", { name: "关于我" }).click();
    return Boolean(await reducedModal.count());
  }).toBe(true);
  await expect(reducedModal.getByRole("status")).toHaveText("打印完成 · 请取走小票");
  expect(await reducedModal.locator(".lucide-loader-circle").count()).toBe(0);
  expect(await reducedModal.locator(".about-printer__paper").evaluate((element) => (
    getComputedStyle(element).transform
  ))).toBe("none");
  await reducedModal.getByRole("button", { name: "关闭" }).click();
});

test("open-source filters cap Motion stagger and honor reduced motion", async ({ page }) => {
  const instrumentListMotion = () => page.evaluate(() => {
    const testWindow = window as typeof window & { __filterMotionDurations: number[] };
    const nativeAnimate = Element.prototype.animate;
    testWindow.__filterMotionDurations = [];
    Element.prototype.animate = function animate(keyframes, options) {
      if (this instanceof HTMLLIElement && this.closest('[aria-label="已判读的开源项目"]')) {
        const duration = typeof options === "number" ? options : options?.duration;
        if (typeof duration === "number") testWindow.__filterMotionDurations.push(duration);
      }
      return nativeAnimate.call(this, keyframes, options);
    };
  });
  const readDurations = () => page.evaluate(() => (
    window as typeof window & { __filterMotionDurations?: number[] }
  ).__filterMotionDurations ?? []);

  await page.goto("/open-source");
  await instrumentListMotion();
  const skillsFilter = page.getByRole("button", { name: /^Skills 与工作流/u });
  await skillsFilter.click();
  await expect(skillsFilter).toHaveAttribute("aria-pressed", "true");
  const filteredRows = await page.locator('[aria-label="已判读的开源项目"] ol > li').count();
  await expect.poll(readDurations).toEqual(Array(Math.min(filteredRows, 8)).fill(280));

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await instrumentListMotion();
  const reducedSkillsFilter = page.getByRole("button", { name: /^Skills 与工作流/u });
  await expect.poll(async () => {
    if (await reducedSkillsFilter.getAttribute("aria-pressed") === "true") return true;
    await reducedSkillsFilter.click();
    return await reducedSkillsFilter.getAttribute("aria-pressed") === "true";
  }).toBe(true);
  expect(await readDurations()).toEqual([]);
  expect(await page.locator('[aria-label="已判读的开源项目"] ol > li').evaluateAll((rows) => (
    rows.every((row) => getComputedStyle(row).opacity === "1")
  ))).toBe(true);
});

test("works keeps purposeful lightbox Motion without list choreography", async ({ page }) => {
  await page.goto("/works");
  const firstEntry = page.locator('[aria-label="我的作品列表"] > li').first();
  expect(await firstEntry.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");

  await page.getByRole("button", { name: /^放大查看：/u }).first().click();
  const dialog = page.getByRole("dialog");
  const figure = dialog.locator("figure");
  await expect(dialog).toBeVisible();
  await expect.poll(() => figure.evaluate((element) => getComputedStyle(element).transform)).not.toBe("none");
  await expect.poll(() => figure.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
  await dialog.getByRole("button", { name: "关闭大图" }).click();
  await expect(dialog).toBeHidden();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const reducedDialog = page.getByRole("dialog");
  await expect.poll(async () => {
    if (await reducedDialog.count()) return true;
    await page.getByRole("button", { name: /^放大查看：/u }).first().click();
    return Boolean(await reducedDialog.count());
  }).toBe(true);
  expect(await reducedDialog.locator("figure").evaluate((element) => (
    getComputedStyle(element).transform
  ))).toBe("none");
  await reducedDialog.getByRole("button", { name: "关闭大图" }).click();
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

test("technical signal motion pauses while offscreen", async ({ page }) => {
  await page.setViewportSize({ height: 250, width: 390 });
  await page.goto("/");
  const field = page.locator(".interactive-dot-field:visible");
  const track = field.locator(".interactive-dot-field__track").first();
  await field.scrollIntoViewIfNeeded();
  await expect.poll(() => track.evaluate((element) => element.getAnimations()[0]?.playState)).toBe("running");

  await page.evaluate(() => window.scrollTo({ behavior: "instant", top: document.documentElement.scrollHeight }));
  await expect.poll(() => track.evaluate((element) => element.getAnimations()[0]?.playState)).toBe("paused");

  await field.scrollIntoViewIfNeeded();
  await expect.poll(() => track.evaluate((element) => element.getAnimations()[0]?.playState)).toBe("running");
});

test("Ask caps clear motion for long conversations", async ({ page }) => {
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

  for (let index = 1; index <= 8; index += 1) {
    await input.fill(`测试问题 ${index}`);
    await page.getByRole("button", { name: "发送问题" }).click();
    const send = page.getByRole("button", { name: "发送问题" });
    await expect(send).toBeVisible();
    await send.locator("svg").evaluate((icon) => icon.getAnimations().forEach((animation) => animation.finish()));
    await expect(send).toBeEnabled();
  }

  await page.getByRole("button", { name: "清空对话" }).click();
  await expect(page.getByText("从公开资料开始")).toBeVisible({ timeout: 1_000 });
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
