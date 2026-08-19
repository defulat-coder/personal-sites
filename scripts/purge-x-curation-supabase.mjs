#!/usr/bin/env node
/** Remove the retired remote X copies only after a SQLite-backed deployment is verified. */

import { createClient } from "@supabase/supabase-js";

import { loadLocalEnv } from "./lib/load-local-env.mjs";

loadLocalEnv(process.cwd());

function requiredEnvironment(key) {
  const value = process.env[key];
  if (!value) throw new Error(`缺少 ${key}；无法清理远端 X 数据。`);
  return value;
}

const client = createClient(
  requiredEnvironment("SUPABASE_URL"),
  requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function remove(table, filter) {
  const { error } = await filter(client.from(table).delete());
  if (error) throw new Error(`清理 ${table} 失败：${error.message}`);
}

await remove("ask_search_documents", (query) => query.eq("source_scope", "daily"));
await remove("x_curation_items", (query) => query.not("id", "is", null));
await remove("x_sync_items", (query) => query.not("id", "is", null));

console.log("远端 X 私有备份、公开投影与 daily 问答索引已清理。");
