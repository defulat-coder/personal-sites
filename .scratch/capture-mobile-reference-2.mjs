// 第二轮：等 Loader 播完再截各栏目首屏 + Loader 结尾帧
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";

const OUT = "var/ios-reference";
mkdirSync(OUT, { recursive: true });
const home = process.env.HOME;
const executablePath = [
  "chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell",
  "chromium-1228/chrome-mac/Chromium.app/Contents/MacOS/Chromium",
].map((c) => `${home}/Library/Caches/ms-playwright/${c}`).find((p) => existsSync(p));

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

// Loader 结尾帧（约 4.7s，电池满绿）
await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4700);
await page.screenshot({ path: `${OUT}/loader-full.png` });

for (const [path, name] of [
  ["/ai-news", "ai-news"],
  ["/curation", "curation"],
  ["/open-source", "open-source"],
  ["/works", "works"],
  ["/ask", "ask"],
]) {
  await page.goto(`http://127.0.0.1:3000${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".opening-loader", { state: "detached", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/tab-${name}.png` });
  // 再截一张详情页
}
await page.goto("http://127.0.0.1:3000/ai-news", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".opening-loader", { state: "detached", timeout: 15000 }).catch(() => {});
await page.waitForTimeout(800);
const first = page.locator("main a[href^='/ai-news/']").first();
if (await first.count()) {
  await first.click();
  await page.waitForSelector(".opening-loader", { state: "detached", timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/tab-ai-news-detail.png` });
}
await browser.close();
console.log("done");
