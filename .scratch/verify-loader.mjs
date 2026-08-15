import { chromium } from "@playwright/test";

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://127.0.0.1:7100/", { waitUntil: "domcontentloaded" });

// loader should appear and start playing once the sequence image has loaded
await page.waitForSelector(".opening-loader--playing", { timeout: 8000 });
const imgInfo = await page.evaluate(() => {
  const img = document.querySelector(".opening-loader__character");
  return {
    decoding: img?.getAttribute("decoding"),
    complete: img?.complete,
    naturalWidth: img?.naturalWidth,
    naturalHeight: img?.naturalHeight,
  };
});
console.log("img:", JSON.stringify(imgInfo));

// SMIL animation check: sample the character region twice, ~0.8s apart
const clip = { x: 620, y: 330, width: 240, height: 240 }; // centered on the character
await page.waitForTimeout(1200);
const shotA = await page.screenshot({ clip });
await page.waitForTimeout(800);
const shotB = await page.screenshot({ clip });
console.log("SMIL frames differ over time:", !shotA.equals(shotB));

// battery cells animating (CSS keyframes)
const cellOpacity = await page.evaluate(() =>
  [...document.querySelectorAll(".opening-loader__battery-cell")].map(
    (el) => getComputedStyle(el).opacity,
  ),
);
console.log("battery cell opacities @~2s:", JSON.stringify(cellOpacity));

// wait for the loader to finish and unmount
await page.waitForSelector(".opening-loader", { state: "detached", timeout: 12000 });
const seen = await page.evaluate(
  () => window.sessionStorage.getItem("opening-loader-played-v1"),
);
console.log("loader unmounted, sessionStorage flag:", seen);
console.log("page errors:", errors.length ? errors : "none");

await browser.close();
