// 验证开场加载层修复:新访客正常播放;已看会话不下载 ample-loader-sequence.svg
import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3100";
const SVG_PATH = "/images/ample-loader-sequence.svg";
const browser = await chromium.launch({ channel: "chrome" });

// 场景 1:新访客 —— 加载层应播放,序列图应加载,截图确认角色动画在动
{
  const context = await browser.newContext();
  const page = await context.newPage();
  let svgFetched = 0;
  page.on("request", (r) => { if (r.url().includes(SVG_PATH)) svgFetched += 1; });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  const overlayVisible = await page.locator(".opening-loader").isVisible();
  const imgCount = await page.locator(".opening-loader__character").count();
  await page.screenshot({ path: ".scratch/verify-loader-fresh-a.png" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: ".scratch/verify-loader-fresh-b.png" });
  console.log("fresh:", JSON.stringify({ overlayVisible, imgCount, svgFetched }));
  await context.close();
}

// 场景 2:已看会话 —— 不应出现加载层,也不应下载序列图
{
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => {
    try { window.sessionStorage.setItem("opening-loader-played-v1", "true"); } catch {}
  });
  let svgFetched = 0;
  page.on("request", (r) => { if (r.url().includes(SVG_PATH)) svgFetched += 1; });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const overlayCount = await page.locator(".opening-loader").count();
  const totalKB = await page.evaluate(() =>
    Math.round(performance.getEntriesByType("resource")
      .reduce((sum, r) => sum + (r.transferSize || r.encodedBodySize || 0), 0) / 1024));
  console.log("seen:", JSON.stringify({ overlayCount, svgFetched, totalKB }));
  await context.close();
}

await browser.close();
