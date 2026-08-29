import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { z } from "zod";

import { aiNewsItemContentSchema } from "@/lib/ai-news-types";
import type { AiNewsItem, AiNewsListItem } from "@/lib/ai-news-types";

export type { AiNewsItem, AiNewsListItem } from "@/lib/ai-news-types";

export type AiNewsSearchDocument = {
  content: string;
  id: string;
  publishedAt: string | null;
  score: number;
  sourceId: string;
  sourceUrl: string;
  title: string;
};

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
const aiNewsSitemapRowSchema = z.object({ id: z.string(), publishedAt: z.string().nullable() });

export type AiNewsPage = {
  hasMore: boolean;
  items: AiNewsListItem[];
};

// 定时任务每 5 分钟增量写入 Supabase、每天回填 7 天窗口；页面动态渲染、
// 每请求直读公开投影，不做时间缓存——打开即最新，不存在「首访拿旧页」的窗口。
export async function getAiNewsPage(offset = 0, limit = AI_NEWS_LIST_LIMIT): Promise<AiNewsPage> {
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
}

export async function getAiNewsSitemapItems() {
  const { data, error } = await getPublicAiNewsClient()
    .from("ai_news_public_items")
    .select("id,publishedAt:content->>publishedAt")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(2500);
  if (error) throw new Error(`读取 Supabase 每日动态 Sitemap 失败：${error.message}`);
  return z.array(aiNewsSitemapRowSchema).parse(data);
}

// react cache 只去重同一次渲染里的重复读取（generateMetadata 与页面各读一次详情）。
export const getAiNewsItem = cache(async (id: string): Promise<AiNewsItem | null> => {
  const client = getPublicAiNewsClient();
  const { data, error } = await client
    .from("ai_news_public_items")
    .select("content,selected")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`读取 Supabase 每日动态详情失败：${error.message}`);
  return data ? toAiNewsItem(aiNewsRowSchema.parse(data)) : null;
});

let askCorpusCache: { expiresAt: number; items: AiNewsItem[] } | undefined;

async function getAiNewsAskCorpus() {
  if (askCorpusCache && askCorpusCache.expiresAt > Date.now()) return askCorpusCache.items;
  const { data, error } = await getPublicAiNewsClient()
    .from("ai_news_public_items")
    .select("content,selected")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(2500);
  if (error) throw new Error(`读取 Supabase 每日动态检索语料失败：${error.message}`);
  const items = z.array(aiNewsRowSchema).parse(data).map(toAiNewsItem);
  askCorpusCache = { expiresAt: Date.now() + 300_000, items };
  return items;
}

function occurrences(text: string, query: string) {
  let count = 0;
  let start = 0;
  while (true) {
    const index = text.indexOf(query, start);
    if (index < 0) return count;
    count += 1;
    start = index + query.length;
  }
}

/** 每日动态仍以 Supabase 为源，Ask 直接读取现有公开表，不再维护第二份远端索引。 */
export async function searchAiNewsDocuments(query: string, limit = 6): Promise<AiNewsSearchDocument[]> {
  const needle = query.trim().toLocaleLowerCase("en-US");
  if (!needle) return [];
  return (await getAiNewsAskCorpus())
    .map((item) => {
      const title = item.title.toLocaleLowerCase("en-US");
      const summary = item.summary.toLocaleLowerCase("en-US");
      const supporting = `${item.reason}\n${item.category}\n${item.sourceName}`.toLocaleLowerCase("en-US");
      return {
        content: [item.summary, item.reason].filter(Boolean).join("\n\n"),
        id: `ai-news:${item.id}`,
        publishedAt: item.publishedAt,
        score: occurrences(title, needle) * 8 + occurrences(summary, needle) * 2 + occurrences(supporting, needle),
        sourceId: item.id,
        sourceUrl: `/ai-news/${encodeURIComponent(item.id)}`,
        title: item.title,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""))
    .slice(0, limit);
}
