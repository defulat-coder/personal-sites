#!/usr/bin/env node
/** Generate the public, Git-tracked SQLite projection from approved private focus queues. */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { toPublicDouyinItem } from "../modules/douyin-sync/curation-projection.mjs";
import { PUBLIC_CURATION_DATABASE_PATH, buildPublicCurationDatabase } from "../modules/focus-sync/public-sqlite.mjs";
import { summarizeDesignClassifications } from "../modules/x-sync/design-classification.mjs";
import { isReadyForPublication, toPublicCurationItem } from "../modules/x-sync/curation-projection.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(path.join(repoRoot, "config/x-curation.json"), "utf8"));
const queue = JSON.parse(await readFile(path.join(repoRoot, config.queueFile), "utf8"));
const douyinConfig = JSON.parse(await readFile(path.join(repoRoot, "config/douyin-curation.json"), "utf8"));

async function readJsonOr(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

const douyinQueue = await readJsonOr(path.join(repoRoot, douyinConfig.queueFile), { items: [] });
const xItems = queue.items.filter(isReadyForPublication).map(toPublicCurationItem);
const items = [
  ...xItems,
  ...douyinQueue.items.filter((item) => item.review?.approved).map(toPublicDouyinItem),
];
const result = await buildPublicCurationDatabase({
  outputPath: path.join(repoRoot, PUBLIC_CURATION_DATABASE_PATH),
  items,
});

console.log(`公开 SQLite 已生成：${PUBLIC_CURATION_DATABASE_PATH}（策展 ${result.itemCount} 条，问答索引 ${result.documentCount} 条）。`);
const designSummary = summarizeDesignClassifications(xItems);
console.log(`设计分类：收录 ${designSummary.include}，排除 ${designSummary.exclude}，待复核 ${designSummary.review}，未分类 ${designSummary.unclassified}；可直接播放视频 ${designSummary.playableVideos}。`);
