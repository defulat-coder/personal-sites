#!/usr/bin/env node
/** Rebuild the server-only public Q&A index from existing public projections. */

import { createClient } from "@supabase/supabase-js";

import { syncAskSearchDocuments, toAiNewsSearchDocuments, toOpenSourceSearchDocuments } from "../modules/ask/search-index.mjs";
import { loadLocalEnv } from "./lib/load-local-env.mjs";

loadLocalEnv(process.cwd());

// 可选参数：只重建指定范围（如定时任务里的 `ask-reindex.mjs ai-news`）；不带参数重建全部。
const ALL_SCOPES = ["daily", "open-source", "ai-news"];
const requestedScopes = process.argv.slice(2);
const scopes = requestedScopes.length > 0 ? [...new Set(requestedScopes)] : ALL_SCOPES;
for (const scope of scopes) {
  if (!ALL_SCOPES.includes(scope)) {
    throw new Error(`未知索引范围：${scope}；可选 ${ALL_SCOPES.join(" / ")}`);
  }
}

function requiredEnvironment(key) {
  const value = process.env[key];
  if (!value) throw new Error(`缺少 ${key}；公开问答索引只能在本机或部署环境重建。`);
  return value;
}

const client = createClient(
  requiredEnvironment("SUPABASE_URL"),
  requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// PostgREST 默认 max-rows=1000：必须显式分页拉全，否则超出行数静默截断，
// 全量重建的索引会悄悄丢掉尾部语料。
const PAGE_SIZE = 1_000;

async function readRows(table, columns) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`读取 ${table} 公开投影失败：${error.message}`);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

const [openSourceRows, aiNewsRows] = await Promise.all([
  scopes.includes("open-source") ? readRows("github_open_source_items", "content,published_at,repo_node_id") : [],
  scopes.includes("ai-news") ? readRows("ai_news_public_items", "content,published_at") : [],
]);

const result = {};
// X 策展已随部署写入 data/curation.sqlite；保留空范围替换以清除旧的远端副本。
if (scopes.includes("daily")) {
  result.dailyCount = await syncAskSearchDocuments(client, "daily", [], { replaceScope: true });
}
if (scopes.includes("open-source")) {
  result.openSourceCount = await syncAskSearchDocuments(client, "open-source", toOpenSourceSearchDocuments(openSourceRows), { replaceScope: true });
}
if (scopes.includes("ai-news")) {
  result.aiNewsCount = await syncAskSearchDocuments(client, "ai-news", toAiNewsSearchDocuments(aiNewsRows), { replaceScope: true });
}

console.log(JSON.stringify(result, null, 2));
