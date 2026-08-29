#!/usr/bin/env node
/**
 * Fetch X bookmarks/likes with the local smaug installation, move only the
 * result into the ignored sensitive queue, then analyze it with the selected local model runtime.
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadLocalEnv } from "./lib/load-local-env.mjs";
import { resolvePiModelConfig } from "./lib/x-curation-ai.mjs";
import { runHistoryPipeline, runSyncPipeline } from "../modules/x-sync/pipeline.mjs";

export { runHistoryPipeline, runSyncPipeline } from "../modules/x-sync/pipeline.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);

function requireValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} 需要一个值。`);
  return value;
}

export function parseSyncArgs(args) {
  const options = {
    source: "both",
    limit: null,
    media: true,
    fetchOnly: false,
    history: false,
    engine: "codex-cli",
    codexModel: "gpt-5.6-luna",
    designConcurrency: null,
    reasoningEffort: "max",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") {
      continue;
    } else if (arg === "--source") {
      options.source = requireValue(args, index, "--source");
      index += 1;
    } else if (arg.startsWith("--source=")) {
      options.source = arg.slice("--source=".length);
    } else if (arg === "--limit") {
      options.limit = Number.parseInt(requireValue(args, index, "--limit"), 10);
      index += 1;
    } else if (arg.startsWith("--limit=")) {
      options.limit = Number.parseInt(arg.slice("--limit=".length), 10);
    } else if (arg === "--engine") {
      options.engine = requireValue(args, index, "--engine");
      index += 1;
    } else if (arg === "--model") {
      options.codexModel = requireValue(args, index, "--model");
      index += 1;
    } else if (arg === "--reasoning-effort") {
      options.reasoningEffort = requireValue(args, index, "--reasoning-effort");
      index += 1;
    } else if (arg === "--design-concurrency") {
      options.designConcurrency = Number.parseInt(requireValue(args, index, "--design-concurrency"), 10);
      index += 1;
    } else if (arg.startsWith("--design-concurrency=")) {
      options.designConcurrency = Number.parseInt(arg.slice("--design-concurrency=".length), 10);
    } else if (arg === "--media") {
      options.media = true;
    } else if (arg === "--no-media") {
      options.media = false;
    } else if (arg === "--fetch-only") {
      options.fetchOnly = true;
    } else if (arg === "--history") {
      options.history = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`不支持的参数：${arg}`);
    }
  }

  if (!['bookmarks', 'likes', 'both'].includes(options.source)) {
    throw new Error("--source 只能是 bookmarks、likes 或 both。");
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit <= 0)) {
    throw new Error("--limit 必须是正整数。");
  }
  if (!new Set(["pi", "codex-cli"]).has(options.engine)) {
    throw new Error("--engine 仅支持 pi 或 codex-cli。");
  }
  if (!new Set(["none", "low", "medium", "high", "xhigh", "max"]).has(options.reasoningEffort)) {
    throw new Error("--reasoning-effort 仅支持 none、low、medium、high、xhigh 或 max。");
  }
  options.designConcurrency ??= options.engine === "codex-cli" ? 40 : 15;
  if (!Number.isInteger(options.designConcurrency) || options.designConcurrency <= 0) {
    throw new Error("--design-concurrency 必须是正整数。");
  }
  return options;
}

function readSmaugCredentials(configPath) {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const authToken = process.env.AUTH_TOKEN ?? config.twitter?.authToken ?? "";
  const ct0 = process.env.CT0 ?? config.twitter?.ct0 ?? "";
  if (!authToken || !ct0) {
    throw new Error("smaug 配置中缺少 X 登录态（auth_token 或 ct0）。");
  }
  return { authToken, ct0 };
}

function printUsage() {
  console.log(`用法：pnpm curation:sync -- [选项]

快捷入口：
  pnpm curation:sync              Codex CLI + GPT-5.6 Luna（Max，默认）
  pnpm curation:sync:kimi -- [选项]  显式改用 Pi Coding Agent + Kimi

选项：
  --source bookmarks|likes|both  抓取来源，默认 both
  --limit <n>                    最多交给解析器处理 n 条条目
  --engine codex-cli|pi          解析器，默认 codex-cli；Pi 需要显式选择
  --model <name>                 Codex CLI 模型，默认 gpt-5.6-luna
  --reasoning-effort <level>     Codex CLI 推理等级，默认 max
  --design-concurrency <n>       缺失设计分类的回填并发；Codex 默认 40，Pi 默认 15
  --no-media                     不抓取媒体元数据（默认会抓取，供设计识别与站内播放）
  --fetch-only                   只抓取并写入策展队列，不调用模型
  --history                      全量抓取历史书签与点赞并导入策展队列
`);
}

function tweetsFromBirdResponse(raw) {
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : Array.isArray(parsed.tweets) ? parsed.tweets : [];
}

async function captureSourceOrder({ birdPath, credentials, source }) {
  try {
    const { stdout } = await execFileAsync(birdPath, [source, "-n", "20", "--json"], {
      cwd: repoRoot,
      env: { ...process.env, AUTH_TOKEN: credentials.authToken, CT0: credentials.ct0 },
      maxBuffer: 10 * 1024 * 1024,
    });
    const capturedAt = new Date().toISOString();
    const snapshot = {
      capturedAt,
      ids: tweetsFromBirdResponse(stdout).map((tweet) => String(tweet.id)).filter(Boolean),
      source,
      version: 1,
    };
    const sourceOrderDir = path.join(repoRoot, "data/sensitive/x-curation/raw/source-order");
    await mkdir(sourceOrderDir, { recursive: true });
    const filename = `${source}-${capturedAt.replaceAll(/[:.]/gu, "-")}.json`;
    const outputPath = path.join(sourceOrderDir, filename);
    await writeFile(outputPath, JSON.stringify(snapshot, null, 2) + "\n", { mode: 0o600 });
    return outputPath;
  } catch (error) {
    console.warn(`无法读取 X ${source} 列表顺序；新条目将暂不写入收录时间和顺序：${error.message}`);
    return null;
  }
}

async function main() {
  const options = parseSyncArgs(process.argv.slice(2));
  if (options.help) return printUsage();

  loadLocalEnv(repoRoot);
  const smaugConfig = path.join(repoRoot, "tools/smaug/smaug.config.json");
  if (!existsSync(smaugConfig)) {
    throw new Error("缺少 tools/smaug/smaug.config.json；请在该目录完成本机 X 登录态配置。");
  }
  if (!process.env.BIRD_PATH && !existsSync(path.join(repoRoot, "node_modules/.bin/bird"))) {
    throw new Error("缺少本地 bird 依赖；请先执行 pnpm install。");
  }
  const credentials = readSmaugCredentials(smaugConfig);

  if (options.history) {
    const curationConfig = JSON.parse(readFileSync(path.join(repoRoot, "config/x-curation.json"), "utf8"));
    await mkdir(path.join(repoRoot, curationConfig.rawDir), { recursive: true });
    const birdPath = process.env.BIRD_PATH ?? path.join(repoRoot, "node_modules/.bin/bird");
    console.log("开始导入全部历史 X 书签与点赞（不调用模型）。");
    await runHistoryPipeline({
      repoRoot,
      birdPath,
      credentials,
    });
    return;
  }

  if (!options.fetchOnly) {
    if (options.engine === "pi") {
      const model = resolvePiModelConfig({ env: process.env });
      if (!process.env.KIMI_API_KEY) {
        throw new Error("缺少 KIMI_API_KEY（可写入本项目被忽略的 .env.local）。");
      }
      console.log(`解析运行时：Pi Coding Agent / ${model.provider}/${model.model}`);
    } else {
      console.log(`解析运行时：Codex CLI / ${options.codexModel}（推理 ${options.reasoningEffort}）`);
    }
  }

  console.log(`开始 X 策展同步：${options.source}${options.fetchOnly ? "（仅抓取）" : "（抓取、解析并生成公开 SQLite）"}`);
  const birdPath = process.env.BIRD_PATH ?? path.join(repoRoot, "node_modules/.bin/bird");
  await runSyncPipeline({
    repoRoot,
    options,
    captureSourceOrder: (source) => captureSourceOrder({ birdPath, credentials, source }),
  });
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(`X 策展同步失败：${error.message}`);
    process.exitCode = 1;
  });
}
