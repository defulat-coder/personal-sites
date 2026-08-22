// 捕获 Web 移动端（390px）参照截图：开屏 Loading 序列 + 首页头部/导航 + 各栏目
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";

const OUT = "var/ios-reference";
mkdirSync(OUT, { recursive: true });

const home = process.env.HOME;
const candidates = [
  "chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell",
  "chromium-1228/chrome-mac/Chromium.app/Contents/MacOS/Chromium",
  "chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell",
];
const executablePath = candidates
  .map((c) => `${home}/Library/Caches/ms-playwright/${c}`)
  .find((p) => existsSync(p));
if (!executablePath) throw new Error("no cached chromium found");

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

// 开屏序列：0.8s / 2.5s / 4.6s（电池充电中段）/ 5.2s（刚离开）
await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded" });
for (const [t, name] of [[800, "loader-1"], [1700, "loader-2"], [2100, "loader-3"]]) {
  await page.waitForTimeout(t);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
await page.waitForTimeout(1600); // 过了 5s + 0.8s 滑出
await page.screenshot({ path: `${OUT}/home-after-loader.png`, fullPage: false });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/home-settled.png` });

// 各栏目首屏（头部/导航状态）
for (const [path, name] of [
  ["/ai-news", "ai-news"],
  ["/curation", "curation"],
  ["/open-source", "open-source"],
  ["/works", "works"],
  ["/ask", "ask"],
]) {
  await page.goto(`http://127.0.0.1:3000${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/tab-${name}.png` });
}

// 首页下拉一屏，看内容流行
await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(7000);
await page.evaluate(() => window.scrollBy(0, 700));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/home-scrolled.png` });

await browser.close();
console.log("done -> var/ios-reference");
