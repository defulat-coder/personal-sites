import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  try { window.sessionStorage.setItem("opening-loader-played-v1", "true"); } catch {}
});
await page.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "关于我" }).click();
await page.waitForTimeout(4000);
const info = await page.evaluate(() => {
  const foot = document.querySelector(".curation-home__about-foot");
  const cs = getComputedStyle(foot);
  return {
    anims: foot.getAnimations().map((a) => ({
      name: a.animationName, playState: a.playState,
      currentTime: a.currentTime, startTime: a.startTime,
    })),
    timelineNow: document.timeline.currentTime,
    animationName: cs.animationName,
    animationDuration: cs.animationDuration,
    animationDelay: cs.animationDelay,
    animationFillMode: cs.animationFillMode,
    animationTimingFunction: cs.animationTimingFunction,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
