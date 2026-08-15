// 生产环境性能实测：导航计时、Web Vitals、资源体积、长任务
import { chromium } from "@playwright/test";

const BASE = process.env.PERF_BASE ?? "http://127.0.0.1:3100";
const ROUTES = ["/", "/curation", "/ask", "/open-source"];

const browser = await chromium.launch({ channel: "chrome" });

for (const route of ROUTES) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.__vitals = { lcp: 0, cls: 0, longTasks: 0, longTaskTotal: 0 };
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) window.__vitals.lcp = last.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) window.__vitals.cls += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__vitals.longTasks += 1;
        window.__vitals.longTaskTotal += e.duration;
      }
    }).observe({ type: "longtask", buffered: true });
  });

  const t0 = Date.now();
  await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(3000); // 让 LCP/长任务稳定

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paint = Object.fromEntries(
      performance.getEntriesByType("paint").map((p) => [p.name, p.startTime]),
    );
    const resources = performance.getEntriesByType("resource");
    const byType = {};
    let totalBytes = 0;
    for (const r of resources) {
      const ext = r.name.split("?")[0].split(".").pop() || "other";
      const type = r.initiatorType === "script" || ext === "js" ? "js"
        : r.initiatorType === "link" || ext === "css" ? "css"
        : ["img", "beacon", "fetch", "xmlhttprequest"].includes(r.initiatorType) ? r.initiatorType
        : "other";
      const size = r.transferSize || r.encodedBodySize || 0;
      byType[type] = byType[type] || { count: 0, bytes: 0 };
      byType[type].count += 1;
      byType[type].bytes += size;
      totalBytes += size;
    }
    return {
      ttfb: nav.responseStart,
      domContentLoaded: nav.domContentLoadedEventEnd,
      load: nav.loadEventEnd,
      fcp: paint["first-contentful-paint"],
      vitals: window.__vitals,
      requestCount: resources.length,
      totalKB: Math.round(totalBytes / 1024),
      byType: Object.fromEntries(
        Object.entries(byType).map(([k, v]) => [k, { count: v.count, kb: Math.round(v.bytes / 1024) }]),
      ),
    };
  });

  console.log(`\n=== ${route} (wallclock ${Date.now() - t0}ms) ===`);
  console.log(JSON.stringify(metrics, null, 2));

  // 列出最大的 5 个资源
  const big = await page.evaluate(() =>
    performance.getEntriesByType("resource")
      .map((r) => ({ name: r.name.replace(/^https?:\/\/[^/]+/, ""), kb: Math.round((r.transferSize || r.encodedBodySize || 0) / 1024) }))
      .sort((a, b) => b.kb - a.kb)
      .slice(0, 5),
  );
  console.log("top resources:", JSON.stringify(big));
  await context.close();
}

await browser.close();
