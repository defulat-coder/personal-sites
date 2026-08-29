import "server-only";

import { z } from "zod";

import { readAiNewsCronHealth } from "@/lib/ai-news-sync.server";
import { getPublicDatabase } from "@/lib/public-database";
import { buildDataHealth } from "@/modules/data-health/status.mjs";

const countRowSchema = z.object({ count: z.number() });
const latestRowSchema = z.object({ count: z.number(), latest: z.string().nullable() });
const platformRowsSchema = z.array(z.object({ count: z.number(), latest: z.string().nullable(), platform: z.enum(["douyin", "x"]) }));

export async function readDataHealth() {
  const database = getPublicDatabase();
  const platformRows = platformRowsSchema.parse(database.prepare(`
    SELECT json_extract(content_json, '$.source.platform') AS platform,
      count(*) AS count, max(coalesce(collected_at, published_at)) AS latest
    FROM curation_items GROUP BY platform
  `).all());
  const platforms = new Map(platformRows.map((row) => [row.platform, row]));
  const count = (table: "ask_documents" | "ask_documents_fts") => countRowSchema.parse(
    database.prepare(`SELECT count(*) AS count FROM ${table}`).get(),
  ).count;
  const latest = (table: "open_source_items" | "project_snapshots") => latestRowSchema.parse(
    database.prepare(`SELECT count(*) AS count, max(published_at) AS latest FROM ${table}`).get(),
  );
  const openSource = latest("open_source_items");
  const works = latest("project_snapshots");
  return buildDataHealth({
    aiNews: await readAiNewsCronHealth(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    publicData: {
      askDocuments: count("ask_documents"),
      askFts: count("ask_documents_fts"),
      curation: {
        douyin: { count: platforms.get("douyin")?.count ?? 0, latestAt: platforms.get("douyin")?.latest ?? null },
        x: { count: platforms.get("x")?.count ?? 0, latestAt: platforms.get("x")?.latest ?? null },
      },
      openSource: { count: openSource.count, latestAt: openSource.latest },
      works: { count: works.count, latestAt: works.latest },
    },
  });
}
