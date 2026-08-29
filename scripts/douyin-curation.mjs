#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { createCodexCliReader, createKimiReader } from "../modules/github-starred/analysis.mjs";
import { DEFAULT_ANALYSIS_ENGINE, resolveAnalysisEngine } from "../modules/analysis/runtime.mjs";
import {
  buildCurationPrompt,
  groundEvidenceExcerpt,
  parseAnalyzerOutput,
  parseCurationResponse,
  parseDownloadManifest,
  toDouyinVideo,
  toReviewItem,
} from "../modules/douyin-sync/import.mjs";
import { loadLocalEnv } from "./lib/load-local-env.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(path.join(repoRoot, "config/douyin-curation.json"), "utf8"));
const queuePath = path.join(repoRoot, config.queueFile);
const rawRoot = path.join(repoRoot, config.rawDir);
const failuresPath = path.join(path.dirname(queuePath), "analysis-failures.json");
const favoriteIndexPath = path.join(path.dirname(queuePath), "favorite-index.json");

export function parseArgs(args) {
  const options = { analyzerConcurrency: null, concurrency: null, engine: DEFAULT_ANALYSIS_ENGINE, force: false, limit: Infinity, manifest: null, refreshOnly: false, stage: null };
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") continue;
    if (argument === "--manifest") options.manifest = args[++index] ?? null;
    else if (argument === "--limit") options.limit = Number.parseInt(args[++index], 10);
    else if (argument === "--concurrency") options.concurrency = Number.parseInt(args[++index], 10);
    else if (argument === "--analyzer-concurrency") options.analyzerConcurrency = Number.parseInt(args[++index], 10);
    else if (argument === "--engine") options.engine = args[++index] ?? "";
    else if (argument === "--force") options.force = true;
    else if (argument === "--refresh-only") options.refreshOnly = true;
    else if (argument.startsWith("--")) throw new Error(`未知参数：${argument}`);
    else positionals.push(argument);
  }
  options.stage = positionals.shift() ?? null;
  if (positionals.length > 0) throw new Error("sync 不接受额外参数。");
  if (options.stage !== "sync") {
    throw new Error("用法：pnpm douyin:curation -- sync --manifest <download_manifest.jsonl> [--refresh-only] [--limit n] [--engine codex-cli|pi]");
  }
  if (options.stage === "sync" && !options.manifest) throw new Error("sync 需要 --manifest <download_manifest.jsonl>。");
  options.engine = resolveAnalysisEngine(options.engine);
  if (options.limit !== Infinity && (!Number.isInteger(options.limit) || options.limit < 1)) throw new Error("--limit 必须是正整数。");
  if (options.concurrency !== null && (!Number.isInteger(options.concurrency) || options.concurrency < 1)) throw new Error("--concurrency 必须是正整数。");
  if (options.analyzerConcurrency !== null && (!Number.isInteger(options.analyzerConcurrency) || options.analyzerConcurrency < 1)) throw new Error("--analyzer-concurrency 必须是正整数。");
  return options;
}

async function readQueue() {
  try {
    return JSON.parse(await readFile(queuePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { items: [], version: 1 };
    throw error;
  }
}

async function writePrivateJson(filePath, value) {
  await mkdir(path.dirname(filePath), { mode: 0o700, recursive: true });
  await writeFile(filePath, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
}

async function readFavoriteOrders() {
  const index = await readFile(favoriteIndexPath, "utf8").then(JSON.parse, (error) => {
    if (error.code === "ENOENT") return { items: [] };
    throw error;
  });
  return new Map(index.items.map((item, order) => [`douyin:${item.id}`, order]));
}

export async function settleConcurrently(targets, concurrency, processTarget) {
  let nextTargetIndex = 0;
  const failures = [];
  async function worker() {
    while (true) {
      const index = nextTargetIndex;
      nextTargetIndex += 1;
      if (index >= targets.length) return;
      try {
        await processTarget(targets[index]);
      } catch (error) {
        failures.push({ error, target: targets[index] });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  return failures;
}

async function analyzeVideo(video) {
  const outputDirectory = path.join(rawRoot, video.awemeId, "frames");
  const { stdout } = await execFileAsync(
    "npx",
    [
      "-y",
      config.analyzer.package,
      "analyze",
      video.videoPath,
      "--detail",
      config.analyzer.detail,
      "--fields",
      config.analyzer.fields,
      "--ocr-language",
      config.analyzer.ocrLanguage,
      "--out",
      outputDirectory,
    ],
    {
      cwd: repoRoot,
      env: { ...process.env, MCP_WRITE_SIDECARS: "1" },
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return parseAnalyzerOutput(stdout);
}

async function sync(options) {
  loadLocalEnv(repoRoot);
  const manifestPath = path.resolve(repoRoot, options.manifest);
  const records = parseDownloadManifest(await readFile(manifestPath, "utf8"));
  const favoriteOrders = await readFavoriteOrders();
  const videos = records
    .map((record) => toDouyinVideo(record, path.dirname(manifestPath)))
    .filter(Boolean)
    .map((video) => ({ ...video, collectedOrder: favoriteOrders.get(`douyin:${video.awemeId}`) ?? null }))
    .slice(0, options.limit);
  const queue = await readQueue();
  const byId = new Map(queue.items.map((item) => [item.id, item]));
  const reviewedAt = new Date().toISOString();
  for (const item of byId.values()) {
    item.collectedOrder = favoriteOrders.get(item.id) ?? item.collectedOrder ?? null;
    item.review = { approved: true, reviewedAt: item.review?.reviewedAt ?? reviewedAt };
  }
  const previousFailures = await readFile(failuresPath, "utf8").then(JSON.parse, (error) => {
    if (error.code === "ENOENT") return { items: [] };
    throw error;
  });
  const failuresById = new Map(previousFailures.items.map((item) => [item.id, item]));
  const concurrency = options.concurrency ?? (options.engine === "pi" ? 2 : 20);
  const analyzerConcurrency = options.analyzerConcurrency ?? 6;
  const reader = options.refreshOnly ? null : options.engine === "pi"
    ? await createKimiReader({ config: {}, repoRoot })
    : await createCodexCliReader({
      config: { analysis: { codex_cli: { model: "gpt-5.6-terra", reasoning_effort: "high" } } },
      repoRoot,
    });

  const targets = options.refreshOnly ? [] : videos.filter((video) => options.force || !byId.has(`douyin:${video.awemeId}`));
  let completed = 0;
  let saveQueue = Promise.resolve();
  function persistQueue() {
    queue.items = [...byId.values()];
    queue.updatedAt = new Date().toISOString();
    const snapshot = JSON.stringify(queue, null, 2) + "\n";
    saveQueue = saveQueue.then(async () => {
      await mkdir(path.dirname(queuePath), { mode: 0o700, recursive: true });
      await writeFile(queuePath, snapshot, { mode: 0o600 });
    });
    return saveQueue;
  }
  await persistQueue();
  let activeAnalyzers = 0;
  const analyzerWaiters = [];

  async function withAnalyzerSlot(callback) {
    if (activeAnalyzers >= analyzerConcurrency) {
      await new Promise((resolve) => analyzerWaiters.push(resolve));
    }
    activeAnalyzers += 1;
    try {
      return await callback();
    } finally {
      activeAnalyzers -= 1;
      analyzerWaiters.shift()?.();
    }
  }

  async function processVideo(video) {
    const id = `douyin:${video.awemeId}`;
    const existing = byId.get(id);
    const evidence = await withAnalyzerSlot(() => analyzeVideo(video));
    const rawEvidencePath = path.join(rawRoot, video.awemeId, "analysis.json");
    await writePrivateJson(rawEvidencePath, { evidence, source: video });
    const parsed = parseCurationResponse(await reader.prompt(buildCurationPrompt(video, evidence, config.taxonomy)));
    parsed.ai.excerpt = groundEvidenceExcerpt(parsed.ai.excerpt, evidence);
    const item = toReviewItem(video, parsed, path.relative(repoRoot, rawEvidencePath), existing);
    byId.set(id, item);
    failuresById.delete(id);
    await persistQueue();
    completed += 1;
    console.log(`[${completed}/${targets.length}] ${id} 已自动批准。`);
  }

  const failures = await settleConcurrently(targets, concurrency, processVideo);
  await saveQueue;
  for (const { error, target } of failures) {
    failuresById.set(`douyin:${target.awemeId}`, {
      error: error instanceof Error ? error.message : String(error),
      failedAt: new Date().toISOString(),
      id: `douyin:${target.awemeId}`,
    });
  }
  await writePrivateJson(failuresPath, { items: [...failuresById.values()], updatedAt: new Date().toISOString(), version: 1 });
  console.log(`抖音关注同步完成：成功 ${completed} 条，失败 ${failures.length} 条；条目已自动批准${options.refreshOnly ? "并已回填收藏顺序" : ""}。`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await sync(options);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(`抖音关注处理失败：${error.message}`);
    process.exitCode = 1;
  });
}
