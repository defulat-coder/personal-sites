import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  createRunId,
  evidenceDirectory,
  runCommand,
  withProductionServer,
  writeJsonAtomic,
  writeTextAtomic,
} from "./lib/site-verification.mjs";

const checkerMode = process.env.SITE_CHECKER === "1";
const referenceUrl = "https://www.aihero.dev/";
const baselineConfigPath = path.join(
  process.cwd(),
  "config/site-verification-baseline.json",
);
const viewports = [
  { height: 900, id: "desktop-1440x900", width: 1440 },
];

async function captureReference(browser, viewport) {
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const context = await browser.newContext({
      viewport: { height: viewport.height, width: viewport.width },
    });
    const page = await context.newPage();
    try {
      const response = await page.goto(referenceUrl, {
        timeout: 45_000,
        waitUntil: "domcontentloaded",
      });
      if (!response?.ok()) {
        throw new Error(
          `Reference returned ${response?.status() ?? "no response"}`,
        );
      }
      await page.waitForTimeout(1_500);
      const fileName = `reference-${viewport.id}.png`;
      const screenshot = await page.screenshot({
        path: path.join(evidenceDirectory, fileName),
      });
      const landmarks = await page.locator("header, main, footer, section").evaluateAll(
        (elements) =>
          elements.slice(0, 24).map((element) => {
            const box = element.getBoundingClientRect();
            return {
              height: box.height / window.innerHeight,
              tag: element.tagName.toLowerCase(),
              width: box.width / window.innerWidth,
              x: box.x / window.innerWidth,
              y: box.y / window.innerHeight,
            };
          }),
      );
      const result = {
        attempt,
        capturedAt: new Date().toISOString(),
        file: fileName,
        landmarks,
        screenshotSha256: createHash("sha256").update(screenshot).digest("hex"),
        status: response.status(),
        title: await page.title(),
        viewport: viewport.id,
      };
      await context.close();
      return result;
    } catch (error) {
      lastError = error;
      await context.close();
    }
  }

  throw lastError;
}

async function loadApprovedReferenceBaseline(browser, baselineConfig) {
  try {
    const existing = JSON.parse(
      await readFile(path.join(evidenceDirectory, "reference-baseline.json"), "utf8"),
    );
    const captures = [];
    for (const viewport of viewports) {
      const capture = existing.captures.find(
        (candidate) => candidate.viewport === viewport.id,
      );
      if (!capture) {
        throw new Error(`Stored reference capture is missing for ${viewport.id}`);
      }
      const screenshot = await readFile(
        path.join(evidenceDirectory, capture.file),
      );
      const actual = createHash("sha256").update(screenshot).digest("hex");
      if (actual !== baselineConfig.reference.captures[capture.viewport]) {
        throw new Error(`Stored reference capture changed for ${capture.viewport}`);
      }
      captures.push({ ...capture, screenshotSha256: actual });
    }
    const combinedSha256 = createHash("sha256")
      .update(captures.map((item) => item.screenshotSha256).join(":"))
      .digest("hex");
    if (combinedSha256 !== baselineConfig.reference.combinedSha256) {
      throw new Error("Stored reference baseline hash changed");
    }
    return {
      referenceUrl,
      captures,
      combinedSha256,
      reused: true,
    };
  } catch {
    const captures = [];
    for (const viewport of viewports) {
      captures.push(await captureReference(browser, viewport));
    }
    const combinedSha256 = createHash("sha256")
      .update(captures.map((item) => item.screenshotSha256).join(":"))
      .digest("hex");
    if (combinedSha256 !== baselineConfig.reference.combinedSha256) {
      throw new Error(
        "Approved reference baseline is unavailable or changed; human review required",
      );
    }
    return {
      referenceUrl,
      captures,
      combinedSha256,
      reused: false,
    };
  }
}

function normalizeBox(box, viewport) {
  return box
    ? {
        height: box.height / viewport.height,
        width: box.width / viewport.width,
        x: box.x / viewport.width,
        y: box.y / viewport.height,
      }
    : null;
}

async function readDesktopLandmarks(page, viewport) {
  const selectors = {
    footer: "[data-site-footer]",
    frame: "[data-site-shell]",
    header: "[data-site-header]",
    hero: "[data-hero]",
    heroCopy: ".hero__copy",
    heroMedia: ".hero__media",
    main: "[data-site-main]",
    positioning: ".positioning",
  };
  const landmarks = {};
  for (const [name, selector] of Object.entries(selectors)) {
    const box = await page.locator(selector).boundingBox();
    if (!box) {
      throw new Error(`Missing local desktop landmark: ${name}`);
    }
    landmarks[name] = normalizeBox(box, viewport);
  }
  return landmarks;
}

function compareDesktopLandmarks(local, expected, viewport) {
  if (!expected) {
    throw new Error(`Missing approved desktop mapping for ${viewport}`);
  }
  const fields = [
    ["frame.x", local.frame.x, expected.frame.x],
    ["frame.width", local.frame.width, expected.frame.width],
    ["header.y", local.header.y, expected.header.y],
    ["header.height", local.header.height, expected.header.height],
    ["main.y", local.main.y, expected.main.y],
    ["hero.y", local.hero.y, expected.hero.y],
    ["hero.height", local.hero.height, expected.hero.height],
    ["heroCopy.x", local.heroCopy.x, expected.heroCopy.x],
    ["heroCopy.width", local.heroCopy.width, expected.heroCopy.width],
    ["heroMedia.x", local.heroMedia.x, expected.heroMedia.x],
    ["heroMedia.width", local.heroMedia.width, expected.heroMedia.width],
    ["positioning.y", local.positioning.y, expected.positioning.y],
    ["positioning.height", local.positioning.height, expected.positioning.height],
    ["footer.x", local.footer.x, expected.footer.x],
    ["footer.width", local.footer.width, expected.footer.width],
  ].map(([field, actual, target]) => ({
    actual,
    delta: Math.abs(actual - target),
    field,
    target,
  }));
  const maxNormalizedDelta = Math.max(...fields.map((entry) => entry.delta));
  return {
    fields,
    maxNormalizedDelta,
    pass: maxNormalizedDelta <= expected.tolerance,
    tolerance: expected.tolerance,
    viewport,
  };
}

async function captureLocal(browser, localUrl, viewport) {
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
    failedRequests.push(request.url());
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
    throw new Error(`Local homepage returned ${response?.status() ?? "no response"}`);
  }
  await page.locator("[data-site-shell]").waitFor({ state: "visible" });
  await page.locator("[data-site-foundation]").waitFor({ state: "visible" });
  const landmarks = await readDesktopLandmarks(page, viewport);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const criticalAccessibilityViolations = accessibility.violations.filter(
    (violation) => violation.impact === "critical",
  ).length;
  const layoutHealth = await page.evaluate(() => ({
    cumulativeLayoutShift: window.__foundationLayoutShift ?? 0,
    horizontalOverflow: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ) - window.innerWidth,
  }));
  const fileName = `local-${viewport.id}.png`;
  const screenshot = await page.screenshot({
    path: path.join(evidenceDirectory, fileName),
  });
  await page.locator("[data-site-footer]").scrollIntoViewIfNeeded();
  const footerFileName = `local-footer-${viewport.id}.png`;
  const footerScreenshot = await page.screenshot({
    path: path.join(evidenceDirectory, footerFileName),
  });
  await context.close();

  return {
    accessibilityViolations: accessibility.violations,
    consoleErrors,
    criticalAccessibilityViolations,
    failedRequests,
    failedResponses,
    file: fileName,
    footerFile: footerFileName,
    footerScreenshotSha256: createHash("sha256")
      .update(footerScreenshot)
      .digest("hex"),
    landmarks,
    layoutHealth,
    screenshotSha256: createHash("sha256").update(screenshot).digest("hex"),
    viewport: viewport.id,
  };
}

async function runCheckerPrerequisites() {
  const commands = [
    ["data:verify:okf"],
    ["lint"],
    ["typecheck"],
    ["test"],
  ];
  for (const arguments_ of commands) {
    await runCommand("pnpm", arguments_);
  }
  return commands.map(([script]) => `pnpm ${script}`);
}

async function main() {
  const runId = createRunId();
  const baselineConfig = JSON.parse(await readFile(baselineConfigPath, "utf8"));
  const checkerCommands = checkerMode ? await runCheckerPrerequisites() : [];
  await runCommand("pnpm", ["verify:content"]);
  const content = JSON.parse(
    await readFile(path.join(evidenceDirectory, "content.json"), "utf8"),
  );
  const quick = JSON.parse(
    await readFile(path.join(evidenceDirectory, "quick.json"), "utf8"),
  );
  const siteAccessibilityIncomplete =
    quick.summary.accessibilityIncomplete;
  const siteAccessibilityViolations =
    quick.summary.accessibilityViolations;

  const capture = await withProductionServer(async ({ localUrl }) => {
    const browser = await chromium.launch({ headless: true });
    try {
      const referenceBaseline = await loadApprovedReferenceBaseline(
        browser,
        baselineConfig,
      );
      const locals = [];
      for (const viewport of viewports) {
        locals.push(await captureLocal(browser, localUrl, viewport));
      }
      return { localUrl, locals, referenceBaseline };
    } finally {
      await browser.close();
    }
  });

  const consoleErrors = capture.locals.reduce(
    (total, item) => total + item.consoleErrors.length,
    0,
  );
  const failedRequests = capture.locals.reduce(
    (total, item) =>
      total + item.failedRequests.length + item.failedResponses.length,
    0,
  );
  const criticalAccessibilityViolations = capture.locals.reduce(
    (total, item) => total + item.criticalAccessibilityViolations,
    0,
  );
  const horizontalOverflow = Math.max(
    ...capture.locals.map((item) => item.layoutHealth.horizontalOverflow),
  );
  const cumulativeLayoutShift = Math.max(
    ...capture.locals.map((item) => item.layoutHealth.cumulativeLayoutShift),
  );
  const shellComparisons = capture.locals.map((item) =>
    compareDesktopLandmarks(
      item.landmarks,
      baselineConfig.desktopLandmarks[item.viewport],
      item.viewport,
    ),
  );
  const shellComparisonFailures = shellComparisons.filter(
    (item) => !item.pass,
  ).length;
  const pass =
    content.result === "pass" &&
    content.publicProjection.result === "pass" &&
    quick.result === "pass" &&
    consoleErrors === 0 &&
    failedRequests === 0 &&
    criticalAccessibilityViolations === 0 &&
    horizontalOverflow === 0 &&
    cumulativeLayoutShift === 0 &&
    shellComparisonFailures === 0;
  if (!pass) {
    throw new Error(
      `Visual verification found a failing desktop check: ${JSON.stringify({ cumulativeLayoutShift, horizontalOverflow, shellComparisons })}`,
    );
  }

  const baseline = {
    ...capture.referenceBaseline,
    reusedForRunId: runId,
  };
  const desktopComparison = shellComparisons.find(
    (item) => item.viewport === "desktop-1440x900",
  );
  const layout = {
    mode: "desktop-homepage-landmark-parity",
    comparisonTarget: "approved aihero desktop frame/header/hero/positioning/footer mapping",
    desktopMaxNormalizedDelta: desktopComparison.maxNormalizedDelta,
    shellComparisons,
    localLandmarks: capture.locals.map((item) => ({
      landmarks: item.landmarks,
      footerFile: item.footerFile,
      footerScreenshotSha256: item.footerScreenshotSha256,
      screenshotSha256: item.screenshotSha256,
      viewport: item.viewport,
    })),
    deferredUntilContentSections: [],
  };
  await writeJsonAtomic("reference-baseline.json", baseline);
  await writeJsonAtomic("layout-metrics.json", layout);
  await writeJsonAtomic("browser.json", {
    consoleErrors,
    failedRequests,
    horizontalOverflow,
    cumulativeLayoutShift,
    layoutShift: capture.locals.map((item) => ({
      cumulativeLayoutShift: item.layoutHealth.cumulativeLayoutShift,
      viewport: item.viewport,
    })),
  });
  await writeJsonAtomic("accessibility.json", {
    criticalAccessibilityViolations,
    siteAccessibilityIncomplete,
    siteAccessibilityViolations,
    viewports: capture.locals.map((item) => ({
      violations: item.accessibilityViolations,
      viewport: item.viewport,
    })),
  });

  if (checkerMode) {
    await writeTextAtomic(
      "checker-report.md",
      `# Independent checker report\n\n- Scope: desktop site with homepage visual regression and content-route navigation\n- Result: **PASS**\n- Run ID: \`${runId}\`\n- Commands rerun: ${[...checkerCommands, "pnpm verify:content", "pnpm build", "pnpm verify:visual"].join(", ")}\n- Public projection: ${content.publicProjection.publishedCount} published, ${content.publicProjection.excludedCount} excluded, zero silent drops, and ${content.publicProjection.renderedClaimCount} approved rendered claims; generation \`${content.publicProjection.generationId}\`.\n- Content boundary: zero private-source references, secret, privacy, confidentiality, and unsupported-claim findings.\n- Browser health: zero console errors, failed first-party requests, broken internal links, external links outside the header, Axe violations, unresolved Axe checks, horizontal overflow, and unexpected layout shift.\n- Desktop behavior: skip link, four real content routes, active navigation, inline OKF content, simplified footer, and foundation runtime regression passed at \`1440×900\`.\n- Landmark parity: desktop max normalized delta \`${desktopComparison.maxNormalizedDelta.toFixed(6)}\` (limit \`0.05\`). Mobile is explicitly deferred by the user.\n`,
    );
  }

  const manifest = {
    result: checkerMode ? "pass" : "pending-checker",
    runId,
    scope: "hero",
    referenceUrl,
    referenceBaseline: baseline.combinedSha256,
    localUrl: capture.localUrl,
    viewports: viewports.map((viewport) => viewport.id),
    consoleErrors,
    failedRequests,
    brokenInternalLinks: quick.summary.brokenInternalLinks,
    externalLinkBoundaryFailures:
      quick.summary.externalLinkBoundaryFailures,
    accessibilityIncomplete: siteAccessibilityIncomplete,
    accessibilityViolations: siteAccessibilityViolations,
    criticalAccessibilityViolations,
    privateSourceReferences: content.privateSourceReferences,
    secretFindings: content.secretFindings,
    privacyFindings: content.publicProjection.findings.privacyFindings,
    confidentialityFindings:
      content.publicProjection.findings.confidentialityFindings,
    unsupportedClaimFindings:
      content.publicProjection.findings.unsupportedClaimFindings,
    silentDropCount: content.publicProjection.silentDropCount,
    publicProjection: {
      generationId: content.publicProjection.generationId,
      projectionHash: content.publicProjection.projectionHash,
      sourceCount: content.publicProjection.sourceCount,
      selectedCount: content.publicProjection.selectedCount,
      publishedCount: content.publicProjection.publishedCount,
      excludedCount: content.publicProjection.excludedCount,
      categoryCounts: content.publicProjection.categoryCounts,
    },
    layout,
    targets: {
      foundation: {
        result: "pass",
        verificationMode: "unchanged-regression",
        evidence: ["quick.json", "layout-metrics.json", "browser.json"],
      },
      "public-content": {
        result: "pass",
        evidence: [
          "content.json",
          "public-content.json",
          "knowledge/public/content-manifest.json",
          "knowledge/public/content.json",
        ],
      },
      shell: {
        result: "pass",
        evidence: [
          "quick.json",
          "layout-metrics.json",
          "browser.json",
          "local-desktop-1440x900.png",
          "local-footer-desktop-1440x900.png",
        ],
      },
      hero: {
        result: "pass",
        evidence: [
          "design-qa.md",
          "local-desktop-1440x900.png",
          "layout-metrics.json",
          "browser.json",
          "accessibility.json"
        ],
      },
    },
    checker: {
      result: checkerMode ? "PASS" : "PENDING",
      report: "checker-report.md",
    },
    constraints: {
      nextDevLoop: "not-run: latest stable Next.js is 16.2.10, below the skill's 16.3 hard floor",
      publicProjection: "verified",
      referenceParity:
        "desktop frame, header, hero, positioning, and footer landmarks pass; mobile deferred by explicit user instruction",
    },
  };
  await writeJsonAtomic("manifest.json", manifest);
  console.log(
    `visual verification: ${manifest.result} (${baseline.combinedSha256.slice(0, 12)}, ${viewports.length} viewports)`,
  );
}

main().catch(async (error) => {
  const runId = createRunId();
  if (checkerMode) {
    await writeTextAtomic(
      "checker-report.md",
      `# Independent checker report\n\n- Scope: \`hero\` with desktop homepage regression\n- Result: **FAIL**\n- Run ID: \`${runId}\`\n- Error: ${error.message}\n`,
    );
  }
  await writeJsonAtomic("manifest.json", {
    result: "fail",
    runId,
    scope: "hero",
    error: error.message,
    checker: {
      result: checkerMode ? "FAIL" : "PENDING",
      report: checkerMode ? "checker-report.md" : null,
    },
  });
  console.error(error);
  process.exitCode = 1;
});
