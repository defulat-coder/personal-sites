#!/usr/bin/env node
/** Generate the public, Git-tracked SQLite projection from the local sensitive X queue. */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PUBLIC_CURATION_DATABASE_PATH, buildPublicCurationDatabase } from "../modules/x-sync/public-sqlite.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(path.join(repoRoot, "config/x-curation.json"), "utf8"));
const queue = JSON.parse(await readFile(path.join(repoRoot, config.queueFile), "utf8"));
const result = await buildPublicCurationDatabase({
  outputPath: path.join(repoRoot, PUBLIC_CURATION_DATABASE_PATH),
  queue,
});

console.log(`公开 SQLite 已生成：${PUBLIC_CURATION_DATABASE_PATH}（策展 ${result.itemCount} 条，问答索引 ${result.documentCount} 条）。`);
