#!/usr/bin/env node
/** 同步上游 AI 资讯（精选 + 24 小时全部动态）到 Supabase；网站只读公开投影表。 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { syncAiNews } from "../modules/ai-news/sync.mjs";
import { loadLocalEnv } from "./lib/load-local-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv(repoRoot);

const backfill = process.argv.includes("--backfill");
const stats = await syncAiNews({ backfill });
if (stats.skipped) {
  console.log("每日动态已有同步任务运行中，本次跳过。");
  process.exit(0);
}
const parts = Object.entries(stats.modes).map(
  ([mode, modeStats]) => `${mode === "selected" ? "精选" : "全部"} ${modeStats.changed ? `${modeStats.count} 条` : "无变化"}`,
);
console.log(`每日动态${backfill ? "七天回填" : "同步"}完成：${parts.join("，")}；公开投影写入 ${stats.publicCount} 条。`);
