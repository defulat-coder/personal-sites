#!/usr/bin/env node
/**
 * build-curation-content.mjs
 *
 * 从策展队列（data/sensitive/x-curation/curation-queue.json，敏感）生成
 * 本地生成备份（data/sensitive/x-curation/generated/curation.json）。
 *
 * 自动输出所有已完成 AI 解析的条目。本文件仅作本机备份，网站不读取它。
 *
 * 用法：
 *   node scripts/build-curation-content.mjs
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isReadyForPublication, toPublicCurationItem } from "../modules/x-sync/curation-projection.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  await readFile(path.join(repoRoot, "config/x-curation.json"), "utf8"),
);

const queuePath = path.join(repoRoot, config.queueFile);
const outputPath = path.join(repoRoot, "data/sensitive/x-curation/generated/curation.json");

const queue = JSON.parse(await readFile(queuePath, "utf8"));
const ready = queue.items.filter(isReadyForPublication);

const items = ready
  .map(toPublicCurationItem)
  .sort((a, b) =>
    (b.collectedAt ?? "").localeCompare(a.collectedAt ?? "")
    || (a.collectedOrder ?? Number.MAX_SAFE_INTEGER) - (b.collectedOrder ?? Number.MAX_SAFE_INTEGER)
    || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  );

const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  items,
};

if (ready.length === 0) {
  console.log("没有已完成 Pi 解析的条目；保留现有本地生成备份。");
  process.exit(0);
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(output, null, 2) + "\n");
console.log(
  `本地生成备份已写入：${path.relative(repoRoot, outputPath)}（${items.length} 条已解析，${queue.items.length - ready.length} 条待 Pi 解析）`,
);
