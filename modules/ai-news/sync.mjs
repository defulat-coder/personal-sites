import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

// 上游 AI 资讯聚合接口：匿名只读、无需密钥。精选与全部动态两个 feed 都同步原始数据，
// 公开投影只保留页面需要的字段，且只收录有第三方原文链接的条目（不回跳上游站点）。
// 注意 feed 顺序：all 在前、selected 在后，同一条目同时命中时 selected 标记以精选为准。
// 上游原生时间窗只有 24h 和 7d：日常增量走 24h，--backfill 走 7d 全量回填。
const ENDPOINT_BASE = "https://aihot.virxact.com/api/v1/items";
const FEED_MODES = ["all", "selected"];
const PAGE_LIMIT = 100;
const MAX_PAGES = 5;
const BACKFILL_MAX_PAGES = 60;
const RETENTION_MS = 8 * 24 * 60 * 60 * 1000;

function requireEnvironment(env, key) {
  const value = env[key];
  if (!value) throw new Error(`缺少 ${key}；请仅在本机或部署环境中配置。`);
  return value;
}

/** 上游条目 → 公开投影；没有第三方原文链接的条目返回 null（不同步到公开表）。 */
export function toPublicAiNewsItem(raw) {
  const url = raw?.links?.original;
  if (!raw?.id || !raw?.title || typeof url !== "string" || !url) return null;
  return {
    category: typeof raw.category === "string" ? raw.category : "",
    id: raw.id,
    publishedAt: typeof raw.publishedAt === "string" ? raw.publishedAt : null,
    reason: stripEmoji(typeof raw.reason === "string" ? raw.reason : ""),
    score: typeof raw.score === "number" ? raw.score : null,
    sourceName: typeof raw.source?.name === "string" ? raw.source.name : "",
    summary: stripEmoji(typeof raw.summary === "string" ? raw.summary : ""),
    title: stripEmoji(raw.title),
    url,
  };
}

// 上游摘要里常残留原文 emoji，与站内单色平面语言冲突，投影时统一清洗。
const EMOJI_PATTERN = /[‍\u{1F000}-\u{1FAFF}☀-➿⬀-⯿][\u{FE0E}\u{FE0F}]?/gu;

export function stripEmoji(text) {
  return text
    .replace(EMOJI_PATTERN, "")
    .replace(/[\t ]{2,}/g, " ")
    .replace(/ +([,.;:!?，。；：！？、）】」])/gu, "$1")
    .trim();
}

/** 把一次抓取到的条目组装成私有表/公开表的 upsert 行。 */
export function buildSyncRows(items, mode, now) {
  const privateRows = [];
  const publicRows = [];
  for (const raw of items) {
    if (!raw?.id) continue;
    privateRows.push({
      feeds: [mode],
      id: raw.id,
      published_at: typeof raw.publishedAt === "string" ? raw.publishedAt : null,
      raw_payload: raw,
      synced_at: now,
    });
    const content = toPublicAiNewsItem(raw);
    if (content) {
      publicRows.push({
        content,
        id: content.id,
        published_at: content.publishedAt,
        selected: mode === "selected",
        synced_at: now,
      });
    }
  }
  return { privateRows, publicRows };
}

export async function fetchFeed(mode, { etag = null, fetchImpl = fetch, maxPages = MAX_PAGES, window = "24h" } = {}) {  const items = [];
  let cursor = null;
  let nextEtag = etag;
  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({ by: "timeline", limit: String(PAGE_LIMIT), mode, window });
    if (cursor) params.set("cursor", cursor);
    const headers = { accept: "application/json" };
    if (page === 0 && etag) headers["if-none-match"] = etag;
    const response = await fetchImpl(`${ENDPOINT_BASE}?${params}`, { headers });
    if (page === 0 && response.status === 304) return { changed: false, items: [] };
    if (!response.ok) throw new Error(`抓取上游 ${mode} 动态失败：HTTP ${response.status}`);
    if (page === 0) nextEtag = response.headers.get("etag") ?? etag;
    const payload = await response.json();
    if (!Array.isArray(payload.items)) throw new Error(`上游 ${mode} 动态响应缺少 items 数组。`);
    items.push(...payload.items);
    cursor = payload.page?.hasMore ? payload.page?.nextCursor ?? null : null;
    if (!cursor) break;
  }
  return { changed: true, etag: nextEtag, items };
}

async function readState(statePath) {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch {
    return { etags: {} };
  }
}

/**
 * 由 GitHub Actions（或本机 launchd 兜底）定时驱动：增量（默认，24h 窗口，每小时）或回填（backfill，7d 窗口，每天）。
 * upsert 到 Supabase 后按发布时间清理 8 天前的行。增量带 If-None-Match，feed 无变化时跳过重写；
 * 回填始终是完整抓取，且不读写增量用的 ETag 状态。
 */
export async function syncAiNews({
  backfill = false,
  env = process.env,
  clientFactory = createClient,
  fetchImpl = fetch,
  repoRoot,
  now = new Date(),
} = {}) {
  if (!repoRoot) throw new Error("缺少 repoRoot；同步脚本必须在本机仓库环境执行。");
  const statePath = path.join(repoRoot, "var/ai-news/sync-state.json");
  const state = backfill ? { etags: {} } : await readState(statePath);
  const window = backfill ? "7d" : "24h";
  const maxPages = backfill ? BACKFILL_MAX_PAGES : MAX_PAGES;
  const client = clientFactory(
    requireEnvironment(env, "SUPABASE_URL"),
    requireEnvironment(env, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const fetchedAt = now.toISOString();
  const stats = { backfill, modes: {}, publicCount: 0 };
  // all feed 的 upsert 会把同 id 行的 selected 覆盖为 false：先记下当前精选 id，
  // 待全部 upsert 结束后统一还原；selected feed 本轮有更新时以它的条目为准。
  const { data: previousSelected, error: selectedReadError } = await client
    .from("ai_news_public_items")
    .select("id")
    .eq("selected", true);
  if (selectedReadError) throw new Error(`读取每日动态精选标记失败：${selectedReadError.message}`);
  let selectedIds = new Set((previousSelected ?? []).map((row) => row.id));

  for (const mode of FEED_MODES) {
    const feed = await fetchFeed(mode, {
      etag: state.etags[mode],
      fetchImpl,
      maxPages,
      window,
    });
    if (!feed.changed) {
      stats.modes[mode] = { changed: false, count: null };
      continue;
    }
    state.etags[mode] = feed.etag;
    const { privateRows, publicRows } = buildSyncRows(feed.items, mode, fetchedAt);

    if (privateRows.length > 0) {
      const { error } = await client.from("ai_news_items").upsert(privateRows, { onConflict: "id" });
      if (error) throw new Error(`写入 Supabase 每日动态原始数据失败：${error.message}`);
    }
    if (publicRows.length > 0) {
      const { error } = await client
        .from("ai_news_public_items")
        .upsert(publicRows, { onConflict: "id" });
      if (error) throw new Error(`写入 Supabase 每日动态公开投影失败：${error.message}`);
    }
    if (mode === "selected") selectedIds = new Set(publicRows.map((row) => row.id));
    stats.publicCount += publicRows.length;
    stats.modes[mode] = { changed: true, count: feed.items.length };
  }

  if (selectedIds.size > 0) {
    const { error } = await client
      .from("ai_news_public_items")
      .update({ selected: true })
      .in("id", [...selectedIds]);
    if (error) throw new Error(`还原每日动态精选标记失败：${error.message}`);
  }

  // 按内容时间清理 8 天前的行；没有发布时间的行退回按同步时间判断。
  const cutoff = new Date(now.getTime() - RETENTION_MS).toISOString();
  const stale = `published_at.lt.${cutoff},and(published_at.is.null,synced_at.lt.${cutoff})`;
  const { error: pruneError } = await client
    .from("ai_news_public_items")
    .delete()
    .or(stale);
  if (pruneError) throw new Error(`清理每日动态公开投影失败：${pruneError.message}`);
  const { error: privatePruneError } = await client
    .from("ai_news_items")
    .delete()
    .or(stale);
  if (privatePruneError) throw new Error(`清理每日动态原始数据失败：${privatePruneError.message}`);

  if (!backfill) {
    await mkdir(path.dirname(statePath), { recursive: true });
    await writeFile(statePath, JSON.stringify({ etags: state.etags }, null, 2));
  }

  return stats;
}
