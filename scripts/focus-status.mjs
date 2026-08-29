#!/usr/bin/env node

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

import { readPublicDataHealth } from "../modules/data-health/sqlite.mjs";
import { buildDataHealth } from "../modules/data-health/status.mjs";
import { loadLocalEnv } from "./lib/load-local-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv(repoRoot);

function requiredEnvironment(key) {
  const value = process.env[key];
  if (!value) throw new Error(`缺少 ${key}。`);
  return value;
}

const client = createClient(
  requiredEnvironment("SUPABASE_URL"),
  requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);
const { data: aiState, error } = await client
  .from("ai_news_sync_state")
  .select("last_error,last_started_at,last_succeeded_at,lease_until")
  .eq("id", "default")
  .maybeSingle();
if (error) throw new Error(`读取每日动态状态失败：${error.message}`);

const databasePath = path.join(repoRoot, "data/curation.sqlite");
const database = new Database(databasePath, { fileMustExist: true, readonly: true });
let status;
try {
  const insightsPath = path.join(repoRoot, "data/sensitive/x-curation/generated/insights.json");
  const insights = existsSync(insightsPath) ? JSON.parse(await readFile(insightsPath, "utf8")) : null;
  const aiAgeMinutes = aiState?.last_succeeded_at
    ? Math.round((Date.now() - Date.parse(aiState.last_succeeded_at)) / 60_000)
    : null;
  status = buildDataHealth({
    aiNews: {
      ageMinutes: aiAgeMinutes,
      healthy: aiAgeMinutes !== null && aiAgeMinutes <= 20 && !aiState?.last_error,
      lastError: aiState?.last_error ?? null,
      lastSucceededAt: aiState?.last_succeeded_at ?? null,
      running: Boolean(aiState?.lease_until && Date.parse(aiState.lease_until) > Date.now()),
    },
    insights: {
      analysisErrors: insights?.health?.analysisErrors ?? null,
      designReview: insights?.health?.designReview ?? null,
    },
    publicData: readPublicDataHealth(database),
  });
} finally {
  database.close();
}

if (process.argv.includes("--json")) console.log(JSON.stringify(status, null, 2));
else {
  console.log(`每日动态：${status.aiNews.healthy ? "正常" : "异常"}（${status.aiNews.ageMinutes ?? "?"} 分钟前）`);
  console.log(`每日关注：X ${status.curation.x.count}，抖音 ${status.curation.douyin.count}，设计待复核 ${status.insights?.designReview ?? "?"}`);
  console.log(`开源关注：${status.openSource.count}；构建：${status.works.count}`);
  console.log(`Ask 索引：${status.askIndex.documents} 文档 / ${status.askIndex.fts} FTS`);
  console.log(`SQLite：${status.database.healthy ? "正常" : status.database.quickCheck}`);
  for (const warning of status.warnings) console.log(`提醒：${warning}`);
}

if (!status.healthy) process.exitCode = 1;
