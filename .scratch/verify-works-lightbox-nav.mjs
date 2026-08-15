// 验收：灯箱内左右切换（按钮 + 方向键 + 循环）。
import { chromium } from "@playwright/test";

const base = "http://127.0.0.1:7100";

const browser = await chromium.launch({ headless: true }).catch(() =>
  chromium.launch({ channel: "chrome", headless: true }),
);
const page = await (await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
})).newPage();
await page.goto(`${base}/works`, { waitUntil: "networkidle" });
await page
  .waitForSelector(".opening-loader", { state: "detached", timeout: 15_000 })
  .catch(() => {});
await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

const caption = page.locator("dialog[open] figcaption");
const label = async () => (await caption.innerText()).replace(/\s/g, " ");

await page.getByRole("button", { name: "放大查看：每日动态" }).click();
await page.waitForSelector("dialog[open]", { timeout: 5000 });
console.log("起点:", await label());

await page.keyboard.press("ArrowRight");
console.log("方向键→:", await label());

await page.getByRole("button", { name: "下一张" }).click();
console.log("按钮下一张:", await label());

await page.keyboard.press("ArrowLeft");
await page.keyboard.press("ArrowLeft");
await page.keyboard.press("ArrowLeft");
console.log("三次←（应循环到最后一张问一问）:", await label());

await page.screenshot({ path: ".impeccable/review/lightbox-nav.png" });
await page.keyboard.press("Escape");
console.log("Esc 关闭:", (await page.locator("dialog[open]").count()) === 0 ? "OK" : "失败");

await browser.close();
