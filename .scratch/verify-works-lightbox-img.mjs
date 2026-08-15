import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true }).catch(() =>
  chromium.launch({ channel: "chrome", headless: true }),
);
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
await page.goto("http://127.0.0.1:7100/works", { waitUntil: "networkidle" });
await page.waitForSelector(".opening-loader", { state: "detached", timeout: 15_000 }).catch(() => {});
await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
await page.getByRole("button", { name: "放大查看：每日动态" }).click();
await page.waitForSelector("dialog[open]");
await page.keyboard.press("ArrowRight");
// 等待灯箱图片切到目标 src 并加载完成
await page.waitForFunction(() => {
  const img = document.querySelector("dialog[open] img");
  return img && img.currentSrc.includes("curation") && img.complete && img.naturalWidth > 0;
}, { timeout: 10000 });
await page.waitForTimeout(300);
const src = await page.$eval("dialog[open] img", (el) => decodeURIComponent(el.currentSrc));
const cap = await page.$eval("dialog[open] figcaption", (el) => el.innerText.replace(/\s/g, " "));
console.log("img src:", src.split("url=")[1]?.split("&")[0] ?? src);
console.log("caption:", cap);
await page.screenshot({ path: ".impeccable/review/lightbox-nav.png" });
await browser.close();
