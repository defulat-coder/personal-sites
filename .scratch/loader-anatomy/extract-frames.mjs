// 从 ample-loader-sequence.svg 抽取指定帧,渲染为 PNG 供剖析图使用
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const SRC = "public/images/ample-loader-sequence.svg";
const OUT = ".scratch/loader-anatomy";
mkdirSync(OUT, { recursive: true });

const svg = readFileSync(SRC, "utf8");
const header = svg.slice(0, svg.indexOf(">", svg.indexOf("<svg")) + 1);

// 按帧切分:<g id="loader-frame-NNN" ...> ... </g>(帧按顺序排列)
const frameRe = /<g id="loader-frame-(\d{3})"[^>]*>/g;
const starts = [];
let m;
while ((m = frameRe.exec(svg))) starts.push({ id: m[1], at: m.index });
console.log("total frames:", starts.length);

function frameMarkup(index) {
  const start = starts[index];
  const end = index + 1 < starts.length ? starts[index + 1].at : svg.lastIndexOf("</svg>");
  let chunk = svg.slice(start.at, end);
  // 去掉尾部的 </g>(帧组的闭合标签在最后)
  chunk = chunk.slice(0, chunk.lastIndexOf("</g>") + 4);
  chunk = chunk.replace('visibility="hidden"', 'visibility="visible"');
  chunk = chunk.replace(/<set [^/]*\/>/g, "");
  return `${header}${chunk}</svg>`;
}

const picks = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((n) => n - 1);
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 700, height: 685 } });

for (const i of picks) {
  const id = starts[i].id;
  const file = `${OUT}/frame-${id}.svg`;
  writeFileSync(file, frameMarkup(i));
  await page.goto("file://" + process.cwd() + "/" + file);
  await page.locator("svg").screenshot({ path: `${OUT}/frame-${id}.png`, omitBackground: true });
  console.log("rendered frame", id);
}

await browser.close();
