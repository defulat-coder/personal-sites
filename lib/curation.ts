import "server-only";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { z } from "zod";

import type { CurationItem, CurationListItem } from "@/lib/curation-types";

const curationItemSchema = z.object({
  analysis: z.string().min(1),
  author: z.object({
    handle: z.string(),
    name: z.string(),
  }),
  collectedAt: z.string().datetime().nullable().default(null),
  collectedOrder: z.number().int().nonnegative().nullable().default(null),
  id: z.string().min(1),
  links: z.array(
    z.object({
      shortUrl: z.string().url().nullable(),
      type: z.string().min(1),
      url: z.string().url(),
    }),
  ),
  media: z.array(
    z.object({
      durationMs: z.number().int().nonnegative().nullable().default(null),
      height: z.number().int().positive().nullable(),
      previewUrl: z.string().url().nullable(),
      type: z.enum(["photo", "video", "animated_gif"]),
      url: z.string().url(),
      videoUrl: z.string().url().nullable().default(null),
      width: z.number().int().positive().nullable(),
    }),
  ),
  publishedAt: z.string().datetime().nullable(),
  quoteContext: z
    .object({
      author: z.string(),
      authorName: z.string(),
      text: z.string(),
    })
    .nullable(),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  text: z.string().min(1),
  title: z.string().min(1),
  tweetUrl: z.string().url(),
});

const curationListItemSchema = z.object({
  author: z.object({ handle: z.string(), name: z.string() }),
  collectedAt: z.string().datetime().nullable().default(null),
  id: z.string().min(1),
  publishedAt: z.string().datetime().nullable(),
  summary: z.string().min(1),
  title: z.string().min(1),
});

function requiredEnvironment(key: "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY") {
  const value = process.env[key];
  if (!value) throw new Error(`缺少 ${key}；网站策展内容只能从 Supabase 读取。`);
  return value;
}

function getPublicCurationClient() {
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_PUBLISHABLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export type CurationPage = {
  hasMore: boolean;
  items: CurationListItem[];
};

const getCachedCurationPage = unstable_cache(
  async (offset: number, limit: number): Promise<CurationPage> => {
    const client = getPublicCurationClient();
    const { data, error } = await client
      .from("x_curation_items")
      .select("author:content->author,collectedAt:content->>collectedAt,id,publishedAt:content->>publishedAt,summary:content->>summary,title:content->>title")
      .order("collected_at", { ascending: false, nullsFirst: false })
      .order("collected_order", { ascending: true, nullsFirst: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit);
    if (error) throw new Error(`读取 Supabase 策展内容失败：${error.message}`);

    const items = z.array(curationListItemSchema).parse(data);
    return {
      hasMore: items.length > limit,
      items: items.slice(0, limit),
    };
  },
  ["public-curation-page-v2"],
  { revalidate: 240, tags: ["public-curation"] },
);

export async function getCurationPage(offset = 0, limit = 20): Promise<CurationPage> {
  return getCachedCurationPage(offset, limit);
}

const getCachedCurationItem = unstable_cache(
  async (id: string): Promise<CurationItem | null> => {
    const client = getPublicCurationClient();
    const { data, error } = await client
      .from("x_curation_items")
      .select("content")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`读取 Supabase 策展内容失败：${error.message}`);
    return data ? curationItemSchema.parse(data.content) : null;
  },
  ["public-curation-item-v1"],
  { revalidate: 240, tags: ["public-curation"] },
);

export const findCurationItem = cache(async (id: string): Promise<CurationItem | null> => {
  return getCachedCurationItem(id);
});
