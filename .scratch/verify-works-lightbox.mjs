// 交互验收：/works 样张点击开灯箱、Esc 关闭、背板点击关闭、在线访问链接存在。
import { chromium } from "@playwright/test";

const base = "http://127.0.0.1:7100";

const browser = await chromium.launch({ headless: true }).catch(() =>
  chromium.launch({ channel: "chrome", headless: true }),
);
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.goto(`${base}/works`, { waitUntil: "networkidle" });
await page
  .waitForSelector(".opening-loader", { state: "detached", timeout: 15_000 })
  .catch(() => {});
await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

// 1. 在线访问链接
const visitLink = page.getByRole("link", { name: "在线访问" });
console.log("在线访问链接:", (await visitLink.count()) > 0 ? await visitLink.getAttribute("href") : "缺失");

// 2. 点击样张开灯箱
await page.getByRole("button", { name: "放大查看：推特点赞" }).click();
const dialog = page.locator("dialog.shotDialog, dialog[class*='shotDialog']");
await page.waitForSelector("dialog[open]", { timeout: 5000 });
await page.waitForTimeout(500);
console.log("灯箱打开: OK");
await page.screenshot({ path: ".impeccable/review/lightbox.png" });

// 3. Esc 关闭
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
console.log("Esc 关闭:", (await page.locator("dialog[open]").count()) === 0 ? "OK" : "失败");

// 4. 背板点击关闭
await page.getByRole("button", { name: "放大查看：每日动态" }).click();
await page.waitForSelector("dialog[open]", { timeout: 5000 });
await page.mouse.click(30, 450); // 背板区域
await page.waitForTimeout(400);
console.log("背板关闭:", (await page.locator("dialog[open]").count()) === 0 ? "OK" : "失败");

await browser.close();
