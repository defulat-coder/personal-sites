import "server-only";

import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";
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

const curationContentRowSchema = z.object({ content_json: z.string().min(1) });
const curationNeighborRowSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});
const dailySearchRowSchema = z.object({
  content: z.string().min(1),
  id: z.string().min(1),
  published_at: z.string().datetime().nullable(),
  search_text: z.string().min(1),
  source_id: z.string().min(1),
  source_url: z.string().min(1),
  title: z.string().min(1),
});

const ATTACHMENT_LABELS = {
  animated_gif: "GIF",
  photo: "图片",
  video: "视频",
} as const;
const CURATION_ORDER = "collected_at DESC NULLS LAST, collected_order ASC NULLS LAST, published_at DESC NULLS LAST, id DESC";
const DATABASE_PATH = path.join(process.cwd(), "data/curation.sqlite");

let database: Database.Database | undefined;

function getCurationDatabase() {
  if (!existsSync(DATABASE_PATH)) {
    throw new Error("缺少 data/curation.sqlite；请先运行 pnpm curation:publish 生成公开策展投影。");
  }
  database ??= new Database(DATABASE_PATH, { fileMustExist: true, readonly: true });
  return database;
}

function parseCurationItem(contentJson: string) {
  return curationItemSchema.parse(JSON.parse(contentJson));
}

/** 把投影行折成列表条目：media/quoteContext 归并为附件登记词，原文与标签随行。 */
function toCurationListItem(item: CurationItem): CurationListItem {
  const mediaKinds = [...new Set(item.media.map((media) => media.type))];
  const attachments: string[] = mediaKinds.map((kind) => ATTACHMENT_LABELS[kind]);
  if (item.quoteContext) attachments.push("引用");
  return {
    attachments,
    author: item.author,
    collectedAt: item.collectedAt,
    id: item.id,
    publishedAt: item.publishedAt,
    summary: item.summary,
    tags: item.tags,
    text: item.text,
    title: item.title,
  };
}

export type CurationPage = {
  hasMore: boolean;
  items: CurationListItem[];
};

export async function getCurationPage(offset = 0, limit = 20): Promise<CurationPage> {
  const rows = getCurationDatabase()
    .prepare(`SELECT content_json FROM curation_items ORDER BY ${CURATION_ORDER} LIMIT ? OFFSET ?`)
    .all(limit + 1, offset)
    .map((row) => curationContentRowSchema.parse(row));
  const items = rows.map((row) => toCurationListItem(parseCurationItem(row.content_json)));
  return { hasMore: items.length > limit, items: items.slice(0, limit) };
}

export type CurationNeighbor = { id: string; title: string } | null;

export type CurationNeighbors = {
  newer: CurationNeighbor;
  older: CurationNeighbor;
};

// 剪报簿总量有限（逐条人工策展的点赞），一次取全量 id+title 即可按列表同一排序定位相邻条目。
export async function getCurationNeighbors(id: string): Promise<CurationNeighbors> {
  const rows = getCurationDatabase()
    .prepare(`SELECT id, title FROM curation_items ORDER BY ${CURATION_ORDER}`)
    .all()
    .map((row) => curationNeighborRowSchema.parse(row));
  const index = rows.findIndex((row) => row.id === id);
  return {
    newer: index > 0 ? (rows[index - 1] ?? null) : null,
    older: index >= 0 ? (rows[index + 1] ?? null) : null,
  };
}

export const findCurationItem = cache(async (id: string): Promise<CurationItem | null> => {
  const row = getCurationDatabase()
    .prepare("SELECT content_json FROM curation_items WHERE id = ?")
    .get(id);
  if (!row) return null;
  return parseCurationItem(curationContentRowSchema.parse(row).content_json);
});

export type CurationDailySearchDocument = {
  content: string;
  id: string;
  publishedAt: string | null;
  score: number;
  sourceId: string;
  sourceUrl: string;
  title: string;
};

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

/** The daily corpus is small and ships with the deployment, so an in-process scorer avoids a second remote X index. */
export function searchCurationDailyDocuments(query: string, limit = 6): CurationDailySearchDocument[] {
  const needle = query.trim().toLocaleLowerCase("en-US");
  if (!needle) return [];

  return getCurationDatabase()
    .prepare("SELECT id, published_at, title, content, search_text, source_id, source_url FROM daily_ask_documents")
    .all()
    .map((row) => dailySearchRowSchema.parse(row))
    .map((row) => {
      const title = row.title.toLocaleLowerCase("en-US");
      const searchText = row.search_text.toLocaleLowerCase("en-US");
      const content = row.content.toLocaleLowerCase("en-US");
      return {
        content: row.content,
        id: row.id,
        publishedAt: row.published_at,
        score: occurrences(title, needle) * 8 + occurrences(searchText, needle) * 2 + occurrences(content, needle),
        sourceId: row.source_id,
        sourceUrl: row.source_url,
        title: row.title,
      };
    })
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score || (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""))
    .slice(0, limit);
}
