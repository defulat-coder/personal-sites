#!/usr/bin/env node
/**
 * GitHub Star 同步、Pi/Kimi 中文阅读版生成与 Supabase 投影。
 * 默认并发为 15；同一 source SHA 会复用已有中文阅读版。
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { openSourceEntries } from "../config/open-source-curation.mjs";
import { analyzeStarredRecords, createKimiReader, readLocalAnalyses } from "../modules/github-starred/analysis.mjs";
import { publishStarredRecords } from "../modules/github-starred/publish-to-supabase.mjs";
import { readLocalSourceRecords, syncStarredRepositories } from "../modules/github-starred/source.mjs";
import { loadLocalEnv } from "./lib/load-local-env.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(path.join(repoRoot, "config/github-sync.json"), "utf8"));
loadLocalEnv(repoRoot);

export function parseGithubStarredArgs(args) {
  const options = { concurrency: null, limit: Infinity, only: null, stage: "run" };
  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") continue;
    if (argument === "--limit") options.limit = Number.parseInt(args[++index], 10);
    else if (argument === "--concurrency") options.concurrency = Number.parseInt(args[++index], 10);
    else if (argument === "--only") options.only = new Set((args[++index] ?? "").split(",").filter(Boolean));
    else if (argument.startsWith("--")) throw new Error(`未知参数：${argument}`);
    else positionals.push(argument);
  }
  if (positionals.length > 1 || (positionals[0] && !["sync", "analyze", "publish", "run"].includes(positionals[0]))) {
    throw new Error("用法：node scripts/github-starred.mjs [sync|analyze|publish|run] [--limit n] [--concurrency n]");
  }
  if (options.limit !== Infinity && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error("--limit 必须是大于 0 的整数。");
  }
  if (options.concurrency !== null && (!Number.isInteger(options.concurrency) || options.concurrency < 1)) {
    throw new Error("--concurrency 必须是大于 0 的整数。");
  }
  if (options.only?.size === 0) throw new Error("--only 至少需要一个 owner/repository。");
  options.stage = positionals[0] ?? "run";
  return options;
}

const options = parseGithubStarredArgs(process.argv.slice(2));
const rawRoot = path.join(repoRoot, config.storage.raw_root);
const derivedRoot = path.join(repoRoot, config.storage.derived_root);
const concurrency = options.concurrency ?? config.analysis?.concurrency ?? 15;
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
  console.log(`Supabase：私有原始资料 ${result.privateSourceCount}，中文阅读版 ${result.privateAnalysisCount}，公开投影 ${result.publicCount}。`);
}

async function synchronize() {
  console.log(`开始同步 GitHub Star：上限 ${Number.isFinite(options.limit) ? options.limit : "全部"}，并发 ${concurrency}。`);
  const existingRecords = options.only ? await readLocalSourceRecords(rawRoot) : null;
  const localRepositories = existingRecords
    ? existingRecords.filter((record) => options.only.has(record.repository.fullName)).map((record) => record.repository)
    : undefined;
  const missingLocalRepositories = options.only
    ? [...options.only].filter((repository) => !localRepositories.some((item) => item.fullName === repository))
    : [];
  if (missingLocalRepositories.length > 0) {
    throw new Error(`指定仓库尚未同步到本地，不能按名称重抓：${missingLocalRepositories.join(", ")}`);
  }
  const records = await syncStarredRepositories({
    concurrency,
    limit: options.limit,
    maxBytes: config.readme.max_bytes,
    onRecord: (record, completed, total) => console.log(`[同步 ${completed}/${total}] ${record.repository.fullName} · ${record.sourceKind}`),
    only: options.only,
    rawRoot,
    repositories: localRepositories,
  });
  console.log(`已同步 ${records.length} 个仓库到本机敏感目录。`);
  await publish(records);
  return records;
}

async function analyze(records) {
  const targets = prioritisePublishedRecords(selectRecords(records));
  console.log(`开始生成中文阅读版：${targets.length} 个仓库，并发 ${concurrency}；官方中文 README 直接使用，其余由 Pi Coding Agent / Kimi 处理。`);
  const needsKimi = targets.some((record) => !record.readingMarkdown);
  const reader = needsKimi ? await createKimiReader({ config, repoRoot }) : null;
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
  console.log(`中文阅读版完成：${results.length} 个仓库，复用已有结果 ${reused} 个，失败 ${results.failures.length} 个。`);
  await publish(records);
  if (results.failures.length > 0) {
    for (const failure of results.failures) console.error(`[解析失败] ${failure.repository}: ${failure.message}`);
    process.exitCode = 1;
  }
}

if (options.stage === "sync") {
  await synchronize();
} else if (options.stage === "analyze") {
  await analyze(await readLocalSourceRecords(rawRoot));
} else if (options.stage === "publish") {
  await publish(selectRecords(await readLocalSourceRecords(rawRoot)));
} else {
  const records = await synchronize();
  await analyze(records);
}
