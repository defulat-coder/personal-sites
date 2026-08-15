import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  try { window.sessionStorage.setItem("opening-loader-played-v1", "true"); } catch {}
});
page.on("console", (m) => console.log("[console]", m.text()));
await page.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "关于我" }).click();
// 打印过程中
await page.waitForTimeout(1500);
await page.screenshot({ path: ".scratch/about-mid.png" });
// 打印结束后
await page.waitForTimeout(2500);
await page.screenshot({ path: ".scratch/about-done.png" });
const info = await page.evaluate(() => {
  const paper = document.querySelector(".curation-home__about-paper");
  const foot = document.querySelector(".curation-home__about-foot");
  const lines = [...document.querySelectorAll(".about-line")];
  return {
    paperClip: paper ? getComputedStyle(paper).clipPath : null,
    paperRect: paper?.getBoundingClientRect().toJSON(),
    footOpacity: foot ? getComputedStyle(foot).opacity : null,
    footRect: foot?.getBoundingClientRect().toJSON(),
    lineOpacities: lines.map((l) => getComputedStyle(l).opacity),
    lineDelays: lines.map((l) => getComputedStyle(l).animationDelay),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
