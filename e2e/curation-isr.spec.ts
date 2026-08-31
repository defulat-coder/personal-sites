import { expect, test } from "@playwright/test";

const CURATION_DETAIL = "/curation/2093695923801210893";
const DESIGN_DETAIL = "/design/2093968955950150059";

test("curation and design detail paths keep ISR without request-time query state", async ({ request }) => {
  for (const path of [CURATION_DETAIL, DESIGN_DETAIL]) {
    const first = await request.get(path);
    expect(first.ok(), path).toBe(true);
    expect(["HIT", "MISS"]).toContain(first.headers()["x-nextjs-cache"]);

    const second = await request.get(path);
    expect(second.ok(), path).toBe(true);
    expect(second.headers()["x-nextjs-cache"]).toBe("HIT");
  }

  const excluded = await request.get("/design/2093695923801210893");
  expect(excluded.status()).toBe(404);
});

test("design list and detail navigation stay in the design path", async ({ page }) => {
  await page.goto("/design");
  const detailLink = page.locator(`a[href="${DESIGN_DETAIL}"]`);
  await expect(detailLink).toBeVisible();
  await detailLink.click();

  await expect(page).toHaveURL(new RegExp(`${DESIGN_DETAIL}$`, "u"));
  await expect(page.getByRole("link", { name: "返回设计收藏" })).toBeVisible();
  await expect(page.locator('nav[aria-label="相邻剪报"] a').first()).toHaveAttribute("href", /\/design\//u);
});
