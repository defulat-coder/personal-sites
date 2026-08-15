import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
page.on("request", (r) => {
  if (["fetch", "xmlhttprequest"].includes(r.resourceType())) console.log(r.method(), r.url());
});
await page.goto("http://127.0.0.1:3100/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);
await browser.close();
