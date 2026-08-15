// 验收截图：/works 案头卷宗布局，桌面 / 移动 / 深色三视角。
import { chromium } from "@playwright/test";

const base = "http://127.0.0.1:7100";
const outDir = ".impeccable/review";

const browser = await chromium.launch({ headless: true }).catch(() =>
  chromium.launch({ channel: "chrome", headless: true }),
);

async function capture(name, { width, height, dark = false }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    colorScheme: dark ? "dark" : "light",
  });
  const page = await context.newPage();
  await page.goto(`${base}/works`, { waitUntil: "networkidle" });
  await page
    .waitForSelector(".opening-loader", { state: "detached", timeout: 15_000 })
    .catch(() => {});
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${outDir}/${name}` });
  console.log(`captured ${name}`);
  await context.close();
}

await capture("desktop.png", { width: 1440, height: 900 });
await capture("mobile.png", { width: 390, height: 844 });
await capture("desktop-dark.png", { width: 1440, height: 900, dark: true });

await browser.close();
