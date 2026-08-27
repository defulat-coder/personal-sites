#!/usr/bin/env node
/**
 * GitHub Star 初始化、每日增量同步、Pi/Kimi 中文阅读版生成与本地 SQLite 投影。
 * 默认并发为 15；每日同步仅处理新仓库或更新过的仓库。
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { openSourceEntries } from "../config/open-source-curation.mjs";
import { analyzeStarredRecords, createCodexCliReader, createKimiReader, ONE_LINE_SUMMARY_VERSION, readLocalAnalyses } from "../modules/github-starred/analysis.mjs";
import { publishStarredRecords } from "../modules/github-starred/publish-to-sqlite.mjs";
import { readLocalSourceRecords, syncStarredRepositories } from "../modules/github-starred/source.mjs";
import { loadLocalEnv } from "./lib/load-local-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(path.join(repoRoot, "config/github-sync.json"), "utf8"));
loadLocalEnv(repoRoot);

export function parseGithubStarredArgs(args) {
  const options = { concurrency: null, engine: "pi", limit: Infinity, only: null, stage: "run" };
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") continue;
    if (argument === "--limit") options.limit = Number.parseInt(args[++index], 10);
    else if (argument === "--concurrency") options.concurrency = Number.parseInt(args[++index], 10);
    else if (argument === "--engine") options.engine = args[++index] ?? "";
    else if (argument === "--only") options.only = new Set((args[++index] ?? "").split(",").filter(Boolean));
    else if (argument.startsWith("--")) throw new Error(`未知参数：${argument}`);
    else positionals.push(argument);
  }
  if (positionals.length > 1 || (positionals[0] && !["init", "daily", "sync", "analyze", "publish", "run"].includes(positionals[0]))) {
    throw new Error("用法：node scripts/github-starred.mjs [init|daily|sync|analyze|publish|run] [--limit n] [--concurrency n]");
  }
  if (options.limit !== Infinity && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error("--limit 必须是大于 0 的整数。");
  }
  if (options.concurrency !== null && (!Number.isInteger(options.concurrency) || options.concurrency < 1)) {
    throw new Error("--concurrency 必须是大于 0 的整数。");
  }
  if (options.only?.size === 0) throw new Error("--only 至少需要一个 owner/repository。");
  if (!new Set(["pi", "codex-cli"]).has(options.engine)) {
    throw new Error("--engine 仅支持 pi 或 codex-cli。");
  }
  options.stage = positionals[0] ?? "run";
  return options;
}

const options = parseGithubStarredArgs(process.argv.slice(2));
const rawRoot = path.join(repoRoot, config.storage.raw_root);
const derivedRoot = path.join(repoRoot, config.storage.derived_root);
const concurrency = options.concurrency
  ?? (options.engine === "codex-cli" ? config.analysis?.codex_cli?.concurrency : config.analysis?.concurrency)
  ?? 15;
const chunkCharacters = config.analysis?.chunk_characters ?? 12000;
const publishRankByRepository = new Map(openSourceEntries.map((entry, index) => [entry.repository, index]));

function prioritisePublishedRecords(records) {
  return [...records].sort((left, right) => {
    const leftRank = publishRankByRepository.get(left.repository.fullName) ?? Infinity;
    const rightRank = publishRankByRepository.get(right.repository.fullName) ?? Infinity;
    return leftRank - rightRank || left.repository.fullName.localeCompare(right.repository.fullName);
  });
}

function selectRecords(records) {
  const selected = options.only ? records.filter((record) => options.only.has(record.repository.fullName)) : records;
  return selected.slice(0, options.limit);
}

async function publish(records) {
  const analyses = await readLocalAnalyses(records, derivedRoot);
  const result = await publishStarredRecords({ analyses, records, seedEntries: openSourceEntries });
  console.log(`本地 SQLite：私有原始资料 ${result.privateSourceCount}，中文阅读版 ${result.privateAnalysisCount}，公开投影 ${result.publicCount}，检索分块 ${result.indexedCount}。`);
}

async function synchronize({ incremental = false } = {}) {
  console.log(`开始${incremental ? "每日增量" : "全量初始化"} GitHub Star：上限 ${Number.isFinite(options.limit) ? options.limit : "全部"}，并发 ${concurrency}。`);
  const existingRecords = incremental ? await readLocalSourceRecords(rawRoot) : [];
  const records = await syncStarredRepositories({
    concurrency,
    existingRecords,
    incremental,
    limit: options.limit,
    maxBytes: config.readme.max_bytes,
    onRecord: (record, completed, total, { changed }) => console.log(`[同步 ${completed}/${total}] ${record.repository.fullName} · ${changed ? record.sourceKind : "未变化"}`),
    only: options.only,
    rawRoot,
  });
  const changedRecords = incremental ? records.changedRecords : records;
  console.log(`已检查 ${records.length} 个仓库；${changedRecords.length} 个仓库需要${incremental ? "增量" : "全量"}解析。`);
  await publish(changedRecords);
  return records;
}

function uniqueRecords(records) {
  return [...new Map(records.map((record) => [record.repository.nodeId, record])).values()];
}

async function recordsMissingAnalysis(records) {
  const analyses = await readLocalAnalyses(records, derivedRoot);
  const completedRepositoryIds = new Set(
    analyses
      .filter((analysis) => analysis.oneLineSummary && analysis.summaryVersion === ONE_LINE_SUMMARY_VERSION && !analysis.summaryFallback)
      .map((analysis) => analysis.repoNodeId),
  );
  return records.filter((record) => !completedRepositoryIds.has(record.repository.nodeId));
}

async function analyze(records) {
  const targets = prioritisePublishedRecords(selectRecords(records));
  const existing = await readLocalAnalyses(targets, derivedRoot);
  const summariesByNodeId = new Set(
    existing
      .filter((analysis) => analysis.oneLineSummary && analysis.summaryVersion === ONE_LINE_SUMMARY_VERSION && !analysis.summaryFallback)
      .map((analysis) => analysis.repoNodeId),
  );
  const engineLabel = options.engine === "codex-cli" ? "Codex CLI" : "Pi Coding Agent / Kimi";
  console.log(`开始生成中文阅读版与一句话简介：${targets.length} 个仓库，并发 ${concurrency}；官方中文 README 直接使用，所有仓库的一句话简介由 ${engineLabel} 生成。`);
  const needsKimi = targets.some((record) => !record.readingMarkdown || !summariesByNodeId.has(record.repository.nodeId));
  const reader = needsKimi
    ? options.engine === "codex-cli"
      ? await createCodexCliReader({ config, repoRoot })
      : await createKimiReader({ config, repoRoot })
    : null;
  const results = await analyzeStarredRecords(targets, {
    chunkCharacters,
    concurrency,
    derivedRoot,
    model: reader?.modelConfig ?? { model: "official-zh-readme", provider: "github" },
    onError: (failure) => console.error(`[解析失败] ${failure.repository}: ${failure.message}`),
    onRecord: async (analysis, record, completed, total) => {
      console.log(`[解析 ${completed}/${total}] ${record.repository.fullName}${analysis.reused ? "（复用）" : ""}`);
      if (publishRankByRepository.has(record.repository.fullName)) {
        await publishStarredRecords({ analyses: [analysis], records: [record], seedEntries: openSourceEntries });
        console.log(`[公开投影] ${record.repository.fullName}`);
      }
    },
    prompt: reader?.prompt,
  });
  const reused = results.filter((item) => item.reused).length;
  console.log(`中文阅读版与一句话简介完成：${results.length} 个仓库，复用已有结果 ${reused} 个，失败 ${results.failures.length} 个。`);
  await publish(records);
  if (results.failures.length > 0) {
    for (const failure of results.failures) console.error(`[解析失败] ${failure.repository}: ${failure.message}`);
    process.exitCode = 1;
  }
}

if (options.stage === "sync") {
  await synchronize({ incremental: false });
} else if (options.stage === "daily") {
  const records = await synchronize({ incremental: true });
  const pending = await recordsMissingAnalysis(records);
  const targets = uniqueRecords([...records.changedRecords, ...pending]);
  console.log(`每日解析队列：变化 ${records.changedRecords.length} 个，待补偿 ${pending.length} 个，合计 ${targets.length} 个。`);
  await analyze(targets);
} else if (options.stage === "analyze") {
  await analyze(await readLocalSourceRecords(rawRoot));
} else if (options.stage === "publish") {
  await publish(selectRecords(await readLocalSourceRecords(rawRoot)));
} else {
  const records = await synchronize({ incremental: false });
  await analyze(records);
}

if (!process.exitCode) {
  const { rebuildDefaultIndex } = await import("./local-vectors.mjs");
  await rebuildDefaultIndex();
}
