import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:7100/", { waitUntil: "domcontentloaded" });
await page.waitForSelector(".opening-loader--playing", { timeout: 8000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: ".scratch/loader-playing.png" });
await browser.close();
