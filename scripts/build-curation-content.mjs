#!/usr/bin/env node
/**
 * build-curation-content.mjs
 *
 * 从策展待审队列（data/private/x-curation/review-queue.json，私有）生成
 * 网站公开投影（data/public/curation.json）。
 *
 * 只输出人工批准（review.status === "approved"）的条目，并剥离所有
 * 审核元数据与私有字段。公开文件可安全提交 Git 并被打包进前端。
 *
 * 用法：
 *   node scripts/build-curation-content.mjs
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  await readFile(path.join(repoRoot, "config/x-curation.json"), "utf8"),
);

const queuePath = path.join(repoRoot, config.reviewQueueFile);
const outputPath = path.join(repoRoot, "data/public/curation.json");

const queue = JSON.parse(await readFile(queuePath, "utf8"));
const approved = queue.items.filter((item) => item.review.status === "approved");

const missing = approved.filter(
  (item) => !item.ai.title || !item.ai.summary || !item.ai.analysis || item.ai.tags.length === 0,
);
if (missing.length > 0) {
  console.error(
    `以下已批准条目缺少 AI 解析字段，无法公开：${missing.map((item) => item.id).join(", ")}`,
  );
  process.exit(1);
}

function toIsoDate(createdAt) {
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const items = approved
  .map((item) => ({
    id: item.id,
    title: item.ai.title,
    summary: item.ai.summary,
    tags: item.ai.tags,
    text: item.text,
    quoteContext:
      item.isQuote && item.quoteContext
        ? {
            author: item.quoteContext.author ?? "",
            authorName: item.quoteContext.authorName ?? "",
            text: item.quoteContext.text ?? "",
          }
        : null,
    analysis: item.ai.analysis,
    author: {
      handle: item.author.handle,
      name: item.author.name,
    },
    tweetUrl: item.tweetUrl,
    links: [
      ...new Map(
        item.links
          .filter((link) => link.expanded && link.type !== "tweet")
          .map((link) => [
            link.expanded,
            { type: link.type, url: link.expanded, shortUrl: link.original ?? null },
          ]),
      ).values(),
    ],
    media: (item.media ?? []).filter((m) => m.url),
    publishedAt: toIsoDate(item.createdAt),
  }))
  .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  items,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(output, null, 2) + "\n");
console.log(`公开投影已生成：${path.relative(repoRoot, outputPath)}（${items.length} 条已批准策展）`);
