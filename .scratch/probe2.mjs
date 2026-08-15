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
  const before = getComputedStyle(foot).opacity;
  const anim = foot.getAnimations()[0];
  const timing = anim?.effect.getComputedTiming();
  // 实验 1:直接拿掉动画,看基值
  foot.style.animation = "none";
  const withoutAnim = getComputedStyle(foot).opacity;
  foot.style.animation = "";
  // 实验 2:把时长从 .01s 改成 .1s(强制重建动画),看最终值
  foot.style.animationDuration = "0.1s";
  const rebuilt = getComputedStyle(foot).opacity;
  return {
    before,
    withoutAnim,
    rebuilt,
    fillMode: timing?.fill, endTime: timing?.endTime,
    progress: timing?.progress, localTime: timing?.localTime,
    text: foot.textContent,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
