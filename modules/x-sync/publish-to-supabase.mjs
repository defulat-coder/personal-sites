import { createClient } from "@supabase/supabase-js";

import { isReadyForPublication, toPublicCurationItem } from "./curation-projection.mjs";

function requireEnvironment(env, key) {
  const value = env[key];
  if (!value) throw new Error(`缺少 ${key}；请仅在本机或部署环境中配置。`);
  return value;
}

function fetchSources(fetchSource) {
  return String(fetchSource ?? "")
    .split("+")
    .filter(Boolean);
}

export async function publishQueueToSupabase(queue, env = process.env) {
  const client = createClient(
    requireEnvironment(env, "SUPABASE_URL"),
    requireEnvironment(env, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const now = new Date().toISOString();
  const privateRows = queue.items.map((item) => ({
    id: item.id,
    fetch_sources: fetchSources(item.fetchSource),
    raw_payload: item,
    generated_payload: item.ai?.enrichedAt ? item.ai : null,
    generated_at: item.ai?.enrichedAt ?? null,
    synced_at: now,
  }));
  const publicRows = queue.items
    .filter(isReadyForPublication)
    .map((item) => {
      const content = toPublicCurationItem(item);
      return {
        id: content.id,
        content,
        published_at: content.publishedAt,
        synced_at: now,
      };
    });

  if (privateRows.length > 0) {
    const { error } = await client.from("x_sync_items").upsert(privateRows, { onConflict: "id" });
    if (error) throw new Error(`写入 Supabase 私有同步数据失败：${error.message}`);
  }
  if (publicRows.length > 0) {
    const { error } = await client.from("x_curation_items").upsert(publicRows, { onConflict: "id" });
    if (error) throw new Error(`写入 Supabase 公开策展数据失败：${error.message}`);
  }
  return { privateCount: privateRows.length, publicCount: publicRows.length };
}
