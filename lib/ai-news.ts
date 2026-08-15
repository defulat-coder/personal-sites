import "server-only";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { z } from "zod";

import { aiNewsItemContentSchema } from "@/lib/ai-news-types";
import type { AiNewsItem, AiNewsListItem } from "@/lib/ai-news-types";

export type { AiNewsItem, AiNewsListItem } from "@/lib/ai-news-types";

// 首页列表一次展示的最近动态条数上限，与客户端加载更多的页大小一致；
// 完整数据都在 Supabase 公开投影里。
export const AI_NEWS_LIST_LIMIT = 50;

function requiredEnvironment(key: "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY") {
  const value = process.env[key];
  if (!value) throw new Error(`缺少 ${key}；网站每日动态只能从 Supabase 公开投影读取。`);
  return value;
}

function getPublicAiNewsClient() {
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_PUBLISHABLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const aiNewsRowSchema = z.object({
  content: aiNewsItemContentSchema,
  selected: z.boolean(),
});

function toAiNewsItem(row: z.infer<typeof aiNewsRowSchema>): AiNewsItem {
  return { ...row.content, selected: row.selected };
}

// 列表路径的投影行：字段平铺（PostgREST content->> 别名），只含列表消费字段。
const aiNewsListRowSchema = aiNewsItemContentSchema
  .omit({ reason: true, score: true, url: true })
  .extend({ selected: z.boolean() });

export type AiNewsPage = {
  hasMore: boolean;
  items: AiNewsListItem[];
};

// 本机定时任务每 5 分钟增量写入 Supabase、每天回填 7 天窗口；页面 ISR 5 分钟，
// 数据缓存略短于页面（4 分钟），保证页面再生时拿到的不是更旧的数据快照。
const getCachedAiNewsPage = unstable_cache(
  async (offset: number, limit: number): Promise<AiNewsPage> => {
    const client = getPublicAiNewsClient();
    const { data, error } = await client
      .from("ai_news_public_items")
      .select("category:content->>category,id,publishedAt:content->>publishedAt,selected,sourceName:content->>sourceName,summary:content->>summary,title:content->>title")
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit);
    if (error) throw new Error(`读取 Supabase 每日动态失败：${error.message}`);
    const items = z.array(aiNewsListRowSchema).parse(data);
    return {
      hasMore: items.length > limit,
      items: items.slice(0, limit),
    };
  },
  ["public-ai-news-page-v2"],
  { revalidate: 240, tags: ["public-ai-news"] },
);

export async function getAiNewsPage(offset = 0, limit = AI_NEWS_LIST_LIMIT): Promise<AiNewsPage> {
  return getCachedAiNewsPage(offset, limit);
}

// 今日快照专用：最近若干天的轻量投影（不含摘要与出处），
// 避免首页首屏被单日动态的体量挤满、看不到前几天的条目。
const AI_NEWS_SNAPSHOT_DAYS = 7;

const aiNewsSnapshotRowSchema = z.object({
  id: z.string().min(1),
  publishedAt: z.string().nullable(),
  selected: z.boolean(),
  title: z.string().min(1),
});

export type AiNewsSnapshotItem = z.infer<typeof aiNewsSnapshotRowSchema>;

const getCachedAiNewsSnapshotItems = unstable_cache(
  async (): Promise<AiNewsSnapshotItem[]> => {
    const client = getPublicAiNewsClient();
    const cutoff = new Date(Date.now() - AI_NEWS_SNAPSHOT_DAYS * 86_400_000).toISOString();
    const { data, error } = await client
      .from("ai_news_public_items")
      .select("id,publishedAt:content->>publishedAt,selected,title:content->>title")
      .gte("published_at", cutoff)
      .order("published_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(`读取 Supabase 每日动态快照失败：${error.message}`);
    return z.array(aiNewsSnapshotRowSchema).parse(data);
  },
  ["public-ai-news-snapshot-v1"],
  { revalidate: 240, tags: ["public-ai-news"] },
);

export async function getAiNewsSnapshotItems(): Promise<AiNewsSnapshotItem[]> {
  return getCachedAiNewsSnapshotItems();
}

const getCachedAiNewsItem = unstable_cache(
  async (id: string): Promise<AiNewsItem | null> => {
    const client = getPublicAiNewsClient();
    const { data, error } = await client
      .from("ai_news_public_items")
      .select("content,selected")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`读取 Supabase 每日动态详情失败：${error.message}`);
    return data ? toAiNewsItem(aiNewsRowSchema.parse(data)) : null;
  },
  ["public-ai-news-item-v1"],
  { revalidate: 240, tags: ["public-ai-news"] },
);

export const getAiNewsItem = cache(async (id: string): Promise<AiNewsItem | null> => {
  return getCachedAiNewsItem(id);
});
