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

import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isReadyForPublication, toPublicCurationItem } from "../modules/x-sync/curation-projection.mjs";
import { prepareCurationItem } from "../modules/x-sync/analysis.mjs";
import { buildCurationInsights, renderCurationInsightsMarkdown } from "../modules/x-sync/insights.mjs";
import { writeJsonAtomically, writeTextAtomically } from "../modules/x-sync/queue-file.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  await readFile(path.join(repoRoot, "config/x-curation.json"), "utf8"),
);

const queuePath = path.join(repoRoot, config.queueFile);
const outputPath = path.join(repoRoot, "data/sensitive/x-curation/generated/curation.json");
const insightsPath = path.join(repoRoot, "data/sensitive/x-curation/generated/insights.json");
const insightsMarkdownPath = path.join(repoRoot, "data/sensitive/x-curation/generated/insights.md");
const insightsSnapshotDirectory = path.join(repoRoot, "data/sensitive/x-curation/generated/insight-snapshots");

const queue = JSON.parse(await readFile(queuePath, "utf8"));
const analyzedItems = queue.items.map((item) => prepareCurationItem(item));
const ready = analyzedItems.filter(isReadyForPublication);

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

await mkdir(path.dirname(outputPath), { recursive: true });
const insights = buildCurationInsights(analyzedItems);
await writeJsonAtomically(insightsPath, insights);
await writeTextAtomically(insightsMarkdownPath, renderCurationInsightsMarkdown(insights));
const snapshotPayload = { ...insights, generatedAt: undefined };
const snapshotDigest = createHash("sha256").update(JSON.stringify(snapshotPayload)).digest("hex").slice(0, 12);
const snapshotPath = path.join(insightsSnapshotDirectory, `${insights.referenceDate.slice(0, 10)}-${snapshotDigest}.json`);
await mkdir(insightsSnapshotDirectory, { recursive: true });
await writeJsonAtomically(snapshotPath, insights);
console.log(`私有全库洞察已写入：${path.relative(repoRoot, insightsPath)}；快照 ${path.basename(snapshotPath)}`);
if (ready.length === 0) {
  console.log("没有已完成解析的条目；保留现有本地生成备份。");
  process.exit(0);
}
await writeJsonAtomically(outputPath, output);
console.log(
  `本地生成备份已写入：${path.relative(repoRoot, outputPath)}（${items.length} 条已解析，${queue.items.length - ready.length} 条待解析）`,
);
