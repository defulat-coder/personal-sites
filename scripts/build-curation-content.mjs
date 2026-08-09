#!/usr/bin/env node
/**
 * build-curation-content.mjs
 *
 * 从策展队列（data/sensitive/x-curation/curation-queue.json，敏感）生成
 * 网站公开投影（data/public/curation.json）。
 *
 * 自动输出所有已完成 AI 解析的条目。公开文件可安全提交 Git 并被打包进前端。
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

const queuePath = path.join(repoRoot, config.queueFile);
const outputPath = path.join(repoRoot, "data/public/curation.json");

const queue = JSON.parse(await readFile(queuePath, "utf8"));
const ready = queue.items.filter(
  (item) => item.ai.title && item.ai.summary && item.ai.analysis && item.ai.tags.length > 0,
);

function toIsoDate(createdAt) {
  const parsed = new Date(createdAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const items = ready
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

if (ready.length === 0) {
  console.log("没有已完成 Pi 解析的条目；保留现有公开投影。");
  process.exit(0);
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(output, null, 2) + "\n");
console.log(
  `公开投影已生成：${path.relative(repoRoot, outputPath)}（${items.length} 条自动发布，${queue.items.length - ready.length} 条待 Pi 解析）`,
);
