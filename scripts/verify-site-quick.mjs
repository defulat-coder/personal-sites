import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createRunId,
  evidenceDirectory,
  withProductionServer,
  writeJsonAtomic,
} from "./lib/site-verification.mjs";
import { publicContentProjectionSchema } from "./lib/public-content-schema.mjs";

const viewports = [
  { height: 900, id: "desktop-1440x900", width: 1440 },
];

async function checkInternalLinks(page, localUrl) {
  const hrefs = await page.locator("a[href]").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")).filter(Boolean),
  );
  const broken = [];

  for (const href of new Set(hrefs)) {
    if (href.startsWith("#")) {
      const exists = await page.locator(href).count();
      if (exists === 0) {
        broken.push(href);
      }
      continue;
    }

    const resolved = new URL(href, localUrl);
    if (resolved.origin !== new URL(localUrl).origin) {
      continue;
    }
    const response = await page.request.get(resolved.href);
    if (!response.ok()) {
      broken.push(href);
    }
  }

  return broken;
}

async function inspectRenderedProjection(page, projection) {
  const renderedClaims = [];
  const renderedItemIds = [];
  const failures = [];

  for (const item of projection.items) {
    const locator = page.locator(`[data-content-id="${item.id}"]`);
    if ((await locator.count()) === 0) {
      failures.push({ itemId: item.id, reason: "missing-item" });
      continue;
    }

    const text = (await locator.allTextContents()).join(" ").replace(/\s+/gu, " ");
    const hrefs = await locator.evaluateAll((elements) =>
      elements.flatMap((element) => [
        ...(element.matches("a") ? [element.getAttribute("href")] : []),
        ...Array.from(element.querySelectorAll("a"), (anchor) =>
          anchor.getAttribute("href"),
        ),
      ]),
    );
    const fields = [
      ["title", text.includes(item.title)],
      ["summary", text.includes(item.summary)],
      ...(item.url ? [["url", hrefs.includes(item.url)]] : []),
    ];
    const failedFields = fields
      .filter(([, rendered]) => !rendered)
      .map(([field]) => field);

    if (failedFields.length > 0) {
      failures.push({ fields: failedFields, itemId: item.id, reason: "missing-claim" });
      continue;
    }
    renderedItemIds.push(item.id);
    renderedClaims.push(
      ...fields.map(([field]) => ({ field, itemId: item.id })),
    );
  }

  return { failures, renderedClaims, renderedItemIds };
}

async function inspectViewport(browser, localUrl, projection, viewport) {
  const context = await browser.newContext({
    viewport: { height: viewport.height, width: viewport.width },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  const failedResponses = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("requestfailed", (request) => {
    failedRequests.push({
      failure: request.failure()?.errorText ?? "unknown",
      url: request.url(),
    });
  });
  page.on("response", (response) => {
    if (response.url().startsWith(localUrl) && response.status() >= 400) {
      failedResponses.push({ status: response.status(), url: response.url() });
    }
  });
  await page.addInitScript(() => {
    window.__foundationLayoutShift = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          window.__foundationLayoutShift += entry.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  const response = await page.goto(localUrl, {
    timeout: 45_000,
    waitUntil: "networkidle",
  });
  if (!response?.ok()) {
    throw new Error(`Homepage returned ${response?.status() ?? "no response"}`);
  }

  const shell = page.locator("[data-site-shell]");
  const foundation = page.locator("[data-site-foundation]");
  const footer = page.locator("[data-site-footer]");
  await shell.waitFor({ state: "visible" });
  await foundation.waitFor({ state: "visible" });

  await page.locator('a[href="#site-main"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/#site-main$/u);

  const targetHrefs = ["#projects", "#knowledge", "#practice", "#about"];
  for (const href of targetHrefs) {
    if ((await page.locator(href).count()) !== 1) {
      throw new Error(`Shell target is missing for ${href}`);
    }
  }

  await page.locator('[data-site-header] a[href="#projects"]').click();
  await page.waitForURL(/#projects$/u);
  await page.locator('[data-site-header] a[href="#knowledge"]').first().click();
  await page.waitForURL(/#knowledge$/u);
  await page.locator('[data-site-header] a[href="#practice"]').first().click();
  await page.waitForURL(/#practice$/u);
  await page.locator('[data-site-header] a[href="#about"]').first().click();
  await page.waitForURL(/#about$/u);

  await footer.scrollIntoViewIfNeeded();
  await footer.waitFor({ state: "visible" });
  await footer.locator('a[href="#top"]').click();
  await page.waitForURL(/#top$/u);

  const shellVersion = await shell.getAttribute("data-shell-version");
  const foundationVersion = await foundation.getAttribute(
    "data-foundation-version",
  );
  if (shellVersion !== "3" || foundationVersion !== "1") {
    throw new Error("Shell or foundation runtime version is invalid");
  }

  const brokenInternalLinks = await checkInternalLinks(page, localUrl);
  const renderedProjection = await inspectRenderedProjection(page, projection);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const criticalViolations = accessibility.violations.filter(
    (violation) => violation.impact === "critical",
  );
  const layout = await page.evaluate(() => ({
    cumulativeLayoutShift: window.__foundationLayoutShift ?? 0,
    horizontalOverflow: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ) - window.innerWidth,
  }));
  const landmarks = await page.evaluate(() => {
    const normalize = (element) => {
      const box = element.getBoundingClientRect();
      return {
        height: box.height / window.innerHeight,
        width: box.width / window.innerWidth,
        x: box.x / window.innerWidth,
        y: box.y / window.innerHeight,
      };
    };
    return {
      footer: normalize(document.querySelector("[data-site-footer]")),
      frame: normalize(document.querySelector("[data-site-shell]")),
      header: normalize(document.querySelector("[data-site-header]")),
      main: normalize(document.querySelector("[data-site-main]")),
    };
  });

  await page.screenshot({
    path: path.join(evidenceDirectory, `quick-${viewport.id}.png`),
  });
  await context.close();

  return {
    accessibilityViolations: accessibility.violations.length,
    brokenInternalLinks,
    consoleErrors,
    contentRenderingFailures: renderedProjection.failures,
    criticalAccessibilityViolations: criticalViolations.length,
    failedRequests,
    failedResponses,
    id: viewport.id,
    foundationVersion,
    layout,
    landmarks,
    shellVersion,
    renderedClaims: renderedProjection.renderedClaims,
    renderedItemIds: renderedProjection.renderedItemIds,
  };
}

async function main() {
  const runId = createRunId();

  try {
    const projection = publicContentProjectionSchema.parse(
      JSON.parse(
        await readFile(
          path.join(process.cwd(), "knowledge/public/content.json"),
          "utf8",
        ),
      ),
    );
    const results = await withProductionServer(async ({ localUrl }) => {
      const browser = await chromium.launch({ headless: true });
      try {
        const viewportResults = [];
        for (const viewport of viewports) {
          viewportResults.push(
            await inspectViewport(browser, localUrl, projection, viewport),
          );
        }
        return { localUrl, viewportResults };
      } finally {
        await browser.close();
      }
    });
    const summary = results.viewportResults.reduce(
      (totals, viewport) => ({
        brokenInternalLinks:
          totals.brokenInternalLinks + viewport.brokenInternalLinks.length,
        contentRenderingFailures:
          totals.contentRenderingFailures +
          viewport.contentRenderingFailures.length,
        consoleErrors: totals.consoleErrors + viewport.consoleErrors.length,
        criticalAccessibilityViolations:
          totals.criticalAccessibilityViolations +
          viewport.criticalAccessibilityViolations,
        failedRequests:
          totals.failedRequests +
          viewport.failedRequests.length +
          viewport.failedResponses.length,
        horizontalOverflow: Math.max(
          totals.horizontalOverflow,
          viewport.layout.horizontalOverflow,
        ),
        cumulativeLayoutShift: Math.max(
          totals.cumulativeLayoutShift,
          viewport.layout.cumulativeLayoutShift,
        ),
      }),
      {
        brokenInternalLinks: 0,
        contentRenderingFailures: 0,
        consoleErrors: 0,
        criticalAccessibilityViolations: 0,
        failedRequests: 0,
        horizontalOverflow: 0,
        cumulativeLayoutShift: 0,
      },
    );
    const pass = Object.values(summary).every((value) => value === 0);
    const evidence = {
      result: pass ? "pass" : "fail",
      runId,
      scope: "desktop-homepage",
      localUrl: results.localUrl,
      changedState: "desktop navigation, hero, approved content sections, and footer",
      adjacentState: "verified foundation runtime and public-content boundary",
      summary,
      publicProjection: {
        contentHash: projection.contentHash,
        renderedClaims: results.viewportResults[0].renderedClaims,
        renderedItemIds: results.viewportResults[0].renderedItemIds,
      },
      viewports: results.viewportResults,
    };
    await writeJsonAtomic("quick.json", evidence);
    console.log(
      `quick verification: ${evidence.result} (${viewports.length} viewports, ${summary.consoleErrors} console errors, ${summary.failedRequests} failed requests)`,
    );
    if (!pass) {
      process.exitCode = 1;
    }
  } catch (error) {
    await writeJsonAtomic("quick.json", {
      result: "fail",
      runId,
      scope: "desktop-homepage",
      error: error.message,
    });
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
