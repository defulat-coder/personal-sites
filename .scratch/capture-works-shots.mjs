// 一次性脚本：为「我的作品」案头卷宗样张带截取本站真实页面截图。
// 用法: node .scratch/capture-works-shots.mjs [port]
import { chromium } from "@playwright/test";

const port = process.argv[2] ?? "7100";
const base = `http://127.0.0.1:${port}`;
const outDir = "public/images/works/personal-site";

const shots = [
  { path: "/", file: "feed.png" },
  { path: "/curation", file: "curation.png" },
  { path: "/open-source", file: "open-source.png" },
  { path: "/ask", file: "ask.png" },
];

const executablePath =
  "/Users/xbjt/Library/Caches/ms-playwright/chromium-*/chrome-mac/";

const browser = await chromium.launch({
  channel: undefined,
  headless: true,
}).catch(async () => {
  // fallback: 使用系统 Chrome
  return chromium.launch({
    channel: "chrome",
    headless: true,
  });
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
});
const page = await context.newPage();

for (const shot of shots) {
  await page.goto(`${base}${shot.path}`, { waitUntil: "networkidle" });
  // 等待首访 Loading 遮罩离场（reduced-motion 下约 1.5s）
  await page
    .waitForSelector(".opening-loader", { state: "detached", timeout: 15_000 })
    .catch(() => {});
  // 隐藏 Next.js 开发工具浮标，避免进作品集样张
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/${shot.file}` });
  console.log(`captured ${shot.path} -> ${shot.file}`);
}

await browser.close();
