#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { createCodexCliReader, createKimiReader } from "../modules/github-starred/analysis.mjs";
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

export function parseArgs(args) {
  const options = { analyzerConcurrency: null, concurrency: null, engine: "codex-cli", force: false, ids: [], limit: Infinity, manifest: null, stage: null };
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
    else if (argument.startsWith("--")) throw new Error(`未知参数：${argument}`);
    else positionals.push(argument);
  }
  options.stage = positionals.shift() ?? null;
  options.ids = positionals;
  if (!new Set(["approve", "list", "sync"]).has(options.stage)) {
    throw new Error("用法：pnpm douyin:curation -- sync --manifest <download_manifest.jsonl> [--limit n] [--engine codex-cli|pi] | list | approve <id...>");
  }
  if (options.stage === "sync" && !options.manifest) throw new Error("sync 需要 --manifest <download_manifest.jsonl>。");
  if (options.stage === "approve" && options.ids.length === 0) throw new Error("approve 至少需要一个条目 id。");
  if (!new Set(["codex-cli", "pi"]).has(options.engine)) throw new Error("--engine 仅支持 codex-cli 或 pi。");
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
  const videos = records
    .map((record) => toDouyinVideo(record, path.dirname(manifestPath)))
    .filter(Boolean)
    .slice(0, options.limit);
  const queue = await readQueue();
  const byId = new Map(queue.items.map((item) => [item.id, item]));
  const previousFailures = await readFile(failuresPath, "utf8").then(JSON.parse, (error) => {
    if (error.code === "ENOENT") return { items: [] };
    throw error;
  });
  const failuresById = new Map(previousFailures.items.map((item) => [item.id, item]));
  const concurrency = options.concurrency ?? (options.engine === "pi" ? 2 : 20);
  const analyzerConcurrency = options.analyzerConcurrency ?? 6;
  const reader = options.engine === "pi"
    ? await createKimiReader({ config: {}, repoRoot })
    : await createCodexCliReader({
      config: { analysis: { codex_cli: { model: "gpt-5.6-terra", reasoning_effort: "high" } } },
      repoRoot,
    });

  const targets = videos.filter((video) => options.force || !byId.has(`douyin:${video.awemeId}`));
  let completed = 0;
  let saveQueue = Promise.resolve();
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
    byId.set(id, toReviewItem(video, parsed, path.relative(repoRoot, rawEvidencePath), existing));
    failuresById.delete(id);
    queue.items = [...byId.values()];
    queue.updatedAt = new Date().toISOString();
    const snapshot = JSON.stringify(queue, null, 2) + "\n";
    saveQueue = saveQueue.then(async () => {
      await mkdir(path.dirname(queuePath), { mode: 0o700, recursive: true });
      await writeFile(queuePath, snapshot, { mode: 0o600 });
    });
    await saveQueue;
    completed += 1;
    console.log(`[${completed}/${targets.length}] ${id} → ${parsed.ai.title} · 实体 ${parsed.mentionedProjects.length}`);
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
  console.log(`抖音关注收件箱已更新：成功 ${completed} 条，失败 ${failures.length} 条；运行 list 查看待审条目。`);
}

async function approve(ids) {
  const queue = await readQueue();
  const requested = new Set(ids);
  let approved = 0;
  for (const item of queue.items) {
    if (!requested.has(item.id)) continue;
    item.review = { approved: true, reviewedAt: new Date().toISOString() };
    requested.delete(item.id);
    approved += 1;
  }
  if (requested.size > 0) throw new Error(`没有找到：${[...requested].join("、")}`);
  queue.updatedAt = new Date().toISOString();
  await writePrivateJson(queuePath, queue);
  console.log(`已批准 ${approved} 条；运行 pnpm curation:publish 生成公开每日关注投影。`);
}

async function list() {
  const queue = await readQueue();
  if (queue.items.length === 0) return console.log("抖音关注收件箱为空。");
  for (const item of queue.items) {
    console.log(`${item.review?.approved ? "[已批准]" : "[待审核]"} ${item.id} · ${item.ai.title}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.stage === "sync") await sync(options);
  else if (options.stage === "approve") await approve(options.ids);
  else await list();
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(`抖音关注处理失败：${error.message}`);
    process.exitCode = 1;
  });
}
