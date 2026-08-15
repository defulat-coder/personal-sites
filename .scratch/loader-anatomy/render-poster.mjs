import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1700, height: 2400 }, deviceScaleFactor: 2 });
await page.goto("file://" + process.cwd() + "/.scratch/loader-anatomy/poster.html");
await page.waitForTimeout(600);
await page.screenshot({ path: ".scratch/loader-anatomy/loader-anatomy.png" });
await browser.close();
console.log("done");
