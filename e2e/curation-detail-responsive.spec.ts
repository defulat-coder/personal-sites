import { expect, test, type Page } from "@playwright/test";

const LOADER_PLAYED_KEY = "personal-site:opening-loader-played";
const LONG_MEDIA_DETAIL_PATH = "/curation/2093968800316293400";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => window.sessionStorage.setItem(key, "true"), LOADER_PLAYED_KEY);
});

async function readSpreadLayout(page: Page) {
  return page.evaluate(() => {
    const body = document.querySelector<HTMLElement>(".curation-detail__body")!;
    const evidence = document.querySelector<HTMLElement>(".curation-detail__evidence")!;
    const reading = document.querySelector<HTMLElement>(".curation-detail__reading")!;
    const evidenceBox = evidence.getBoundingClientRect();
    const readingBox = reading.getBoundingClientRect();
    const evidenceStyle = getComputedStyle(evidence);

    return {
      bodyColumns: getComputedStyle(body).gridTemplateColumns,
      evidence: {
        bottom: evidenceBox.bottom,
        clientHeight: evidence.clientHeight,
        overflowY: evidenceStyle.overflowY,
        position: evidenceStyle.position,
        scrollHeight: evidence.scrollHeight,
        width: evidenceBox.width,
        x: evidenceBox.x,
        y: evidenceBox.y,
      },
      reading: {
        width: readingBox.width,
        x: readingBox.x,
        y: readingBox.y,
      },
    };
  });
}

test("curation spread uses one column until 1200px, then restores sticky facing pages", async ({ page }) => {
  for (const width of [901, 1_199]) {
    await page.setViewportSize({ height: 900, width });
    await page.goto(LONG_MEDIA_DETAIL_PATH);
    await expect(page.locator(".curation-detail__body")).toBeVisible();

    const layout = await readSpreadLayout(page);
    expect(layout.bodyColumns.trim().split(/\s+/u)).toHaveLength(1);
    expect(layout.evidence.position).toBe("static");
    expect(layout.evidence.overflowY).toBe("visible");
    expect(layout.evidence.clientHeight).toBe(layout.evidence.scrollHeight);
    expect(layout.reading.y).toBeGreaterThan(layout.evidence.bottom);
    expect(layout.reading.x).toBeCloseTo(layout.evidence.x, 1);
    expect(layout.reading.width).toBeCloseTo(layout.evidence.width, 1);
  }

  for (const width of [1_200, 1_440]) {
    await page.setViewportSize({ height: 900, width });
    await page.goto(LONG_MEDIA_DETAIL_PATH);
    await expect(page.locator(".curation-detail__body")).toBeVisible();

    const layout = await readSpreadLayout(page);
    expect(layout.bodyColumns.trim().split(/\s+/u)).toHaveLength(2);
    expect(layout.evidence.position).toBe("sticky");
    expect(layout.evidence.overflowY).toBe("auto");
    expect(layout.evidence.scrollHeight).toBeGreaterThan(layout.evidence.clientHeight);
    expect(layout.reading.x).toBeGreaterThan(layout.evidence.x + layout.evidence.width);
    expect(layout.reading.y).toBeCloseTo(layout.evidence.y, 1);
  }
});

test("intermediate spread widths keep wheel scrolling on the document", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 901 });
  await page.goto(LONG_MEDIA_DETAIL_PATH);

  const evidence = page.locator(".curation-detail__evidence");
  const evidenceBox = await evidence.boundingBox();
  expect(evidenceBox).not.toBeNull();
  if (!evidenceBox) return;

  await page.mouse.move(evidenceBox.x + evidenceBox.width / 2, Math.min(evidenceBox.y + 120, 760));
  await page.mouse.wheel(0, 700);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  expect(await evidence.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(page.locator(".curation-detail__article")).toHaveCSS("overflow", "visible");
});

for (const path of [LONG_MEDIA_DETAIL_PATH, "/open-source/loopx"] as const) {
  test(`${path} keeps native BODY PageDown scrolling`, async ({ page }) => {
    await page.setViewportSize({ height: 640, width: 1_440 });
    await page.goto(path);

    await expect.poll(() => page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeGreaterThan(640);
    await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await page.keyboard.press("PageDown");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
}

test("single-column spread keeps its layout in dark theme and on mobile", async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1_199 });
  await page.goto(LONG_MEDIA_DETAIL_PATH);
  await page.locator(".curation-home__profile .curation-theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-curation-theme", "dark");
  expect((await readSpreadLayout(page)).evidence.position).toBe("static");

  await page.setViewportSize({ height: 844, width: 390 });
  await page.reload();
  const layout = await readSpreadLayout(page);
  expect(layout.evidence.position).toBe("static");
  expect(layout.reading.y).toBeGreaterThan(layout.evidence.bottom);
  await expect(page.locator(".curation-home__profile")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
