import "server-only";

import Database from "better-sqlite3";
import { existsSync, statSync } from "node:fs";
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
  design: z
    .object({
      categories: z.array(z.string().min(1)).max(3),
      classifiedAt: z.string().datetime(),
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.string().min(1)).max(4),
      reason: z.string().min(1),
      relevant: z.boolean(),
      status: z.enum(["include", "review", "exclude"]),
    })
    .nullable()
    .default(null),
  facts: z
    .object({
      version: z.number().int().positive(),
      contentType: z.enum(["original", "quote", "reply"]),
      domains: z.array(z.string()),
      hashtags: z.array(z.string()),
      linkTypes: z.array(z.string()),
      mediaTypes: z.array(z.string()),
      mentions: z.array(z.string()),
      sourceKinds: z.array(z.string()),
      tools: z.array(z.string()),
    })
    .default({
      version: 1,
      contentType: "original",
      domains: [],
      hashtags: [],
      linkTypes: [],
      mediaTypes: [],
      mentions: [],
      sourceKinds: [],
      tools: [],
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
  source: z.object({
    label: z.string().min(1),
    platform: z.enum(["douyin", "x"]),
    url: z.string().url(),
  }),
  searchSignals: z
    .object({
      concepts: z.array(z.string()),
      entities: z.array(z.string()),
      problems: z.array(z.string()),
      sentiment: z.enum(["positive", "negative", "neutral", "humorous", "controversial"]),
      tools: z.array(z.string()),
      useCases: z.array(z.string()),
    })
    .nullable()
    .default(null),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  text: z.string().min(1),
  title: z.string().min(1),
  visualFacts: z
    .object({
      interactionSignals: z.array(z.string()),
      objects: z.array(z.string()),
      ocr: z.array(z.string()),
      scenes: z.array(z.string()),
      styles: z.array(z.string()),
      tools: z.array(z.string()),
    })
    .nullable()
    .default(null),
});

const curationContentRowSchema = z.object({ content_json: z.string().min(1) });
const curationNeighborRowSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});
const localSearchRowSchema = z.object({
  content: z.string().min(1),
  id: z.string().min(1),
  published_at: z.string().datetime({ offset: true }).nullable(),
  search_text: z.string().min(1),
  section: z.string().nullable(),
  source_id: z.string().min(1),
  source_scope: z.enum(["daily", "open-source", "profile", "works"]),
  source_url: z.string().min(1),
  title: z.string().min(1),
});
const localSearchFtsRowSchema = z.object({ id: z.string().min(1), rank: z.number() });

const ATTACHMENT_LABELS = {
  animated_gif: "GIF",
  photo: "图片",
  video: "视频",
} as const;
const CURATION_ORDER = "collected_at DESC NULLS LAST, collected_order ASC NULLS LAST, published_at DESC NULLS LAST, id DESC";
const DOUYIN_CURATION_ORDER = "collected_order ASC NULLS LAST, collected_at DESC NULLS LAST, published_at DESC NULLS LAST, id DESC";
const CURATION_PLATFORM = "json_extract(content_json, '$.source.platform')";
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
    design: item.design,
    id: item.id,
    media: item.media,
    publishedAt: item.publishedAt,
    source: item.source,
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

type CurationPlatform = "douyin" | "x";

async function getCurationPageByPlatform(platform: CurationPlatform, offset: number, limit: number): Promise<CurationPage> {
  const order = platform === "douyin" ? DOUYIN_CURATION_ORDER : CURATION_ORDER;
  const rows = getCurationDatabase()
    .prepare(`SELECT content_json FROM curation_items WHERE ${CURATION_PLATFORM} = ? ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(platform, limit + 1, offset)
    .map((row) => curationContentRowSchema.parse(row));
  const items = rows.map((row) => toCurationListItem(parseCurationItem(row.content_json)));
  return { hasMore: items.length > limit, items: items.slice(0, limit) };
}

/** 每日关注：来源拆分后只呈现 X 条目；抖音条目由 /douyin 板块承载。 */
export async function getCurationPage(offset = 0, limit = 20): Promise<CurationPage> {
  return getCurationPageByPlatform("x", offset, limit);
}

/** 抖音收藏板块：只呈现公开投影中已发布的抖音来源条目。 */
export async function getDouyinCurationPage(offset = 0, limit = 20): Promise<CurationPage> {
  return getCurationPageByPlatform("douyin", offset, limit);
}

/** 设计收藏：只呈现模型高置信收录的 X 条目；中置信结果留在本地队列等待复核。 */
export async function getDesignCurationPage(offset = 0, limit = 20): Promise<CurationPage> {
  const rows = getCurationDatabase()
    .prepare(`SELECT content_json FROM curation_items
      WHERE ${CURATION_PLATFORM} = 'x'
        AND json_extract(content_json, '$.design.status') = 'include'
      ORDER BY ${CURATION_ORDER} LIMIT ? OFFSET ?`)
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

const curationPlatformRowSchema = z.object({ platform: z.enum(["douyin", "x"]) });

// 剪报簿总量有限（逐条人工策展的点赞），一次取全量 id+title 即可按列表同一排序定位相邻条目。
// 来源拆分后相邻导航不跨来源：抖音条目只在抖音条目间翻页，X 条目只在 X 条目间翻页。
export async function getCurationNeighbors(id: string, designOnly = false): Promise<CurationNeighbors> {
  const platformRow = getCurationDatabase()
    .prepare(`SELECT ${CURATION_PLATFORM} AS platform FROM curation_items WHERE id = ?`)
    .get(id);
  if (!platformRow) return { newer: null, older: null };
  const { platform } = curationPlatformRowSchema.parse(platformRow);
  const order = platform === "douyin" ? DOUYIN_CURATION_ORDER : CURATION_ORDER;
  const rows = getCurationDatabase()
    .prepare(`SELECT id, title FROM curation_items
      WHERE ${CURATION_PLATFORM} = ?
        ${designOnly ? "AND json_extract(content_json, '$.design.status') = 'include'" : ""}
      ORDER BY ${order}`)
    .all(platform)
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

type DailySearchCorpusEntry = {
  content: string;
  id: string;
  lowercaseContent: string;
  lowercaseSearchText: string;
  lowercaseTitle: string;
  publishedAt: string | null;
  section: string | null;
  sourceId: string;
  sourceScope: "daily" | "open-source" | "profile" | "works";
  sourceUrl: string;
  title: string;
};

// 语料随部署冻结（curation.sqlite 打包进产物）：按 DB 文件 mtime 做模块级缓存，
// 小写文本只预处理一次，避免每次提问都全表 SELECT + 逐行 zod parse + 三次 lowercase
//（检索的 fallback 路径下单次提问会重复调用本函数多次）。
let dailySearchCorpusCache: { entries: DailySearchCorpusEntry[]; mtimeMs: number } | undefined;

function getDailySearchCorpus(): DailySearchCorpusEntry[] {
  const db = getCurationDatabase();
  const mtimeMs = statSync(DATABASE_PATH).mtimeMs;
  if (dailySearchCorpusCache?.mtimeMs === mtimeMs) return dailySearchCorpusCache.entries;

  const entries = db
    .prepare("SELECT id, source_scope, published_at, title, section, content, search_text, source_id, source_url FROM ask_documents")
    .all()
    .map((row) => localSearchRowSchema.parse(row))
    .map((row) => ({
      content: row.content,
      id: row.id,
      lowercaseContent: row.content.toLocaleLowerCase("en-US"),
      lowercaseSearchText: row.search_text.toLocaleLowerCase("en-US"),
      lowercaseTitle: row.title.toLocaleLowerCase("en-US"),
      publishedAt: row.published_at,
      section: row.section,
      sourceId: row.source_id,
      sourceScope: row.source_scope,
      sourceUrl: row.source_url,
      title: row.title,
    }));
  dailySearchCorpusCache = { entries, mtimeMs };
  return entries;
}

export function searchCurationDailyDocuments(query: string, limit = 6): CurationDailySearchDocument[] {
  return searchLocalAskDocuments(query, "daily", limit).map((document) => ({
    content: document.content,
    id: document.id,
    publishedAt: document.publishedAt,
    score: document.score,
    sourceId: document.sourceId,
    sourceUrl: document.sourceUrl,
    title: document.title,
  }));
}

export type LocalAskDocument = CurationDailySearchDocument & {
  scope: "daily" | "open-source" | "profile" | "works";
  section: string | null;
};

function searchLocalAskFts(query: string, scope: "daily" | "open-source" | "profile" | "works", limit: number) {
  if (Array.from(query).length < 3) return [];
  try {
    return getCurationDatabase()
      .prepare(`SELECT documents.id, bm25(ask_documents_fts, 6.0, 1.0) AS rank
        FROM ask_documents_fts
        JOIN ask_documents AS documents ON documents.rowid = ask_documents_fts.rowid
        WHERE ask_documents_fts MATCH ? AND documents.source_scope = ?
        ORDER BY rank
        LIMIT ?`)
      .all(`"${query.replaceAll('"', '""')}"`, scope, limit)
      .map((row) => localSearchFtsRowSchema.parse(row));
  } catch {
    return [];
  }
}

export function searchLocalAskDocuments(
  query: string,
  scope: "daily" | "open-source" | "profile" | "works",
  limit = 6,
): LocalAskDocument[] {
  const needle = query.trim().toLocaleLowerCase("en-US");
  if (!needle) return [];

  const corpus = getDailySearchCorpus().filter((entry) => entry.sourceScope === scope);
  const byId = new Map(corpus.map((entry) => [entry.id, entry]));
  const ftsRows = searchLocalAskFts(needle, scope, limit * 4);
  if (ftsRows.length > 0) {
    return ftsRows
      .flatMap((row, index) => {
        const entry = byId.get(String(row.id));
        if (!entry) return [];
        return [{
          content: entry.content,
          id: entry.id,
          publishedAt: entry.publishedAt,
          score: 4 / (index + 1)
            + occurrences(entry.lowercaseTitle, needle) * 8
            + occurrences(entry.lowercaseSearchText, needle) * 2,
          scope: entry.sourceScope,
          section: entry.section,
          sourceId: entry.sourceId,
          sourceUrl: entry.sourceUrl,
          title: entry.title,
        }];
      })
      .slice(0, limit);
  }

  return corpus
    .map((entry) => ({
      content: entry.content,
      id: entry.id,
      publishedAt: entry.publishedAt,
      score: occurrences(entry.lowercaseTitle, needle) * 8
        + occurrences(entry.lowercaseSearchText, needle) * 2
        + occurrences(entry.lowercaseContent, needle),
      scope: entry.sourceScope,
      section: entry.section,
      sourceId: entry.sourceId,
      sourceUrl: entry.sourceUrl,
      title: entry.title,
    }))
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score || (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""))
    .slice(0, limit);
}
