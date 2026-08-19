#!/usr/bin/env node
/** Rebuild the server-only public Q&A index from existing public projections. */

import { createClient } from "@supabase/supabase-js";

import { syncAskSearchDocuments, toAiNewsSearchDocuments, toOpenSourceSearchDocuments } from "../modules/ask/search-index.mjs";
import { loadLocalEnv } from "./lib/load-local-env.mjs";

loadLocalEnv(process.cwd());

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

async function readRows(table, columns) {
  const { data, error } = await client.from(table).select(columns);
  if (error) throw new Error(`读取 ${table} 公开投影失败：${error.message}`);
  return data;
}

const [openSourceRows, aiNewsRows] = await Promise.all([
  readRows("github_open_source_items", "content,published_at,repo_node_id"),
  readRows("ai_news_public_items", "content,published_at"),
]);

// X 策展已随部署写入 data/curation.sqlite；保留空范围替换以清除旧的远端副本。
const dailyCount = await syncAskSearchDocuments(client, "daily", [], { replaceScope: true });
const openSourceCount = await syncAskSearchDocuments(client, "open-source", toOpenSourceSearchDocuments(openSourceRows), { replaceScope: true });
const aiNewsCount = await syncAskSearchDocuments(client, "ai-news", toAiNewsSearchDocuments(aiNewsRows), { replaceScope: true });

console.log(JSON.stringify({ aiNewsCount, dailyCount, openSourceCount }, null, 2));
