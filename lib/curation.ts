import "server-only";

import { createClient } from "@supabase/supabase-js";
import { connection } from "next/server";
import { z } from "zod";

import type { CurationItem } from "@/lib/curation-types";

const curationItemSchema = z.object({
  analysis: z.string().min(1),
  author: z.object({
    handle: z.string(),
    name: z.string(),
  }),
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

function requiredEnvironment(key: "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY") {
  const value = process.env[key];
  if (!value) throw new Error(`缺少 ${key}；网站策展内容只能从 Supabase 读取。`);
  return value;
}

async function getCurationClient() {
  await connection();
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_PUBLISHABLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function getCurationItems(): Promise<CurationItem[]> {
  const client = await getCurationClient();
  const { data, error } = await client
    .from("x_curation_items")
    .select("content")
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`读取 Supabase 策展内容失败：${error.message}`);
  return z.array(curationItemSchema).parse(data.map((row) => row.content));
}

export async function getCurationTags() {
  const items = await getCurationItems();
  return [...new Set(items.flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export async function findCurationItem(id: string) {
  const client = await getCurationClient();
  const { data, error } = await client
    .from("x_curation_items")
    .select("content")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`读取 Supabase 策展内容失败：${error.message}`);
  return data ? curationItemSchema.parse(data.content) : null;
}
