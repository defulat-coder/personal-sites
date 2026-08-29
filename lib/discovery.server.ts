import "server-only";

import { z } from "zod";

import { getAiNewsPage, getAiNewsSitemapItems } from "@/lib/ai-news";
import { getPublicDatabase } from "@/lib/public-database";
import { SITE_URL } from "@/lib/site";

const datedIdSchema = z.object({ id: z.string(), published_at: z.string().nullable() });
const slugRowSchema = z.object({ published_at: z.string(), slug: z.string() });
const contentRowSchema = z.object({ content_json: z.string(), published_at: z.string().nullable() });
const snapshotRowSchema = z.object({ published_at: z.string(), snapshot_json: z.string() });

export async function getSitemapRecords() {
  const database = getPublicDatabase();
  const curation = database.prepare("SELECT id, published_at FROM curation_items ORDER BY published_at DESC").all()
    .map((row) => datedIdSchema.parse(row))
    .map((row) => ({ lastModified: row.published_at, url: `${SITE_URL}/curation/${encodeURIComponent(row.id)}` }));
  const openSource = database.prepare("SELECT slug, published_at FROM open_source_items ORDER BY published_at DESC").all()
    .map((row) => slugRowSchema.parse(row))
    .map((row) => ({ lastModified: row.published_at, url: `${SITE_URL}/open-source/${encodeURIComponent(row.slug)}` }));
  const works = database.prepare("SELECT slug, published_at FROM project_snapshots ORDER BY published_at DESC").all()
    .map((row) => slugRowSchema.parse(row))
    .map((row) => ({ lastModified: row.published_at, url: `${SITE_URL}/works/${encodeURIComponent(row.slug)}` }));
  const aiNews = (await getAiNewsSitemapItems()).map((item) => ({
    lastModified: item.publishedAt,
    url: `${SITE_URL}/ai-news/${encodeURIComponent(item.id)}`,
  }));
  return [...aiNews, ...curation, ...openSource, ...works];
}

export type FeedItem = { description: string; publishedAt: string | null; title: string; url: string };

export async function getFeedItems(limit = 100): Promise<FeedItem[]> {
  const database = getPublicDatabase();
  const curation = database.prepare("SELECT content_json, published_at FROM curation_items ORDER BY published_at DESC LIMIT 50").all()
    .map((row) => contentRowSchema.parse(row))
    .map((row) => {
      const item = JSON.parse(row.content_json);
      return {
        description: String(item.summary ?? ""),
        publishedAt: row.published_at,
        title: String(item.title ?? ""),
        url: `${SITE_URL}/curation/${encodeURIComponent(String(item.id))}`,
      };
    });
  const openSource = database.prepare("SELECT content_json, published_at FROM open_source_items ORDER BY published_at DESC LIMIT 25").all()
    .map((row) => contentRowSchema.parse(row))
    .map((row) => {
      const item = JSON.parse(row.content_json);
      return {
        description: String(item.sourceSummary ?? ""),
        publishedAt: row.published_at,
        title: String(item.repository ?? ""),
        url: `${SITE_URL}/open-source/${encodeURIComponent(String(item.slug))}`,
      };
    });
  const works = database.prepare("SELECT snapshot_json, published_at FROM project_snapshots ORDER BY published_at DESC").all()
    .map((row) => snapshotRowSchema.parse(row))
    .map((row) => {
      const item = JSON.parse(row.snapshot_json);
      return {
        description: String(item.summary ?? ""),
        publishedAt: row.published_at,
        title: String(item.title ?? ""),
        url: `${SITE_URL}/works/${encodeURIComponent(String(item.slug))}`,
      };
    });
  const aiNews = (await getAiNewsPage(0, 50)).items.map((item) => ({
    description: item.summary,
    publishedAt: item.publishedAt,
    title: item.title,
    url: `${SITE_URL}/ai-news/${encodeURIComponent(item.id)}`,
  }));
  return [...aiNews, ...curation, ...openSource, ...works]
    .filter((item) => item.title && item.url)
    .sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""))
    .slice(0, limit);
}
