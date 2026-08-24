#!/usr/bin/env node
/** Generate the public, Git-tracked SQLite projection from approved private focus queues. */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { toPublicDouyinItem } from "../modules/douyin-sync/curation-projection.mjs";
import { PUBLIC_CURATION_DATABASE_PATH, buildPublicCurationDatabase } from "../modules/focus-sync/public-sqlite.mjs";
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
const items = [
  ...queue.items.filter(isReadyForPublication).map(toPublicCurationItem),
  ...douyinQueue.items.filter((item) => item.review?.approved).map(toPublicDouyinItem),
];
const result = await buildPublicCurationDatabase({
  outputPath: path.join(repoRoot, PUBLIC_CURATION_DATABASE_PATH),
  items,
});

console.log(`公开 SQLite 已生成：${PUBLIC_CURATION_DATABASE_PATH}（策展 ${result.itemCount} 条，问答索引 ${result.documentCount} 条）。`);
