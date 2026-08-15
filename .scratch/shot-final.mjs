import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:3100/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
await page.screenshot({ path: ".scratch/final-loader.png" });
await page.waitForTimeout(4500); // 加载层播完收起
await page.screenshot({ path: ".scratch/final-home.png" });
await browser.close();
