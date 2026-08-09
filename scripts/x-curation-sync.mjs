#!/usr/bin/env node
/**
 * Fetch X bookmarks/likes with the local smaug installation, move only the
 * result into the ignored sensitive queue, then analyze it with Pi Coding Agent.
 */

import { spawn } from "node:child_process";
import { closeSync, existsSync, openSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadLocalEnv } from "./lib/load-local-env.mjs";
import { resolvePiModelConfig } from "./lib/x-curation-ai.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function requireValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} 需要一个值。`);
  return value;
}

export function parseSyncArgs(args) {
  const options = {
    source: "both",
    limit: null,
    media: false,
    fetchOnly: false,
    history: false,
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
    } else if (arg === "--media") {
      options.media = true;
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
  return options;
}

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const outputDescriptor = options.stdoutPath ? openSync(options.stdoutPath, "w", 0o600) : null;
    let outputClosed = false;
    const closeOutput = () => {
      if (outputDescriptor !== null && !outputClosed) {
        closeSync(outputDescriptor);
        outputClosed = true;
      }
    };
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["inherit", outputDescriptor ?? "inherit", "inherit"],
    });
    child.once("error", (error) => {
      closeOutput();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      closeOutput();
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} 退出异常（code=${code ?? "null"}, signal=${signal ?? "none"}）。`));
    });
  });
}

export async function runSyncPipeline({ repoRoot, options, env = process.env, execute = runCommand }) {
  const smaugRoot = path.join(repoRoot, "tools/smaug");
  const birdPath = env.BIRD_PATH ?? path.join(repoRoot, "node_modules/.bin/bird");
  const sources = options.source === "both" ? ["bookmarks", "likes"] : [options.source];

  for (const source of sources) {
    const fetchArgs = ["src/cli.js", "fetch", "--source", source];
    if (options.media) fetchArgs.push("--media");

    await execute(process.execPath, fetchArgs, { cwd: smaugRoot, env: { BIRD_PATH: birdPath } });
    await execute(
      process.execPath,
      [path.join(repoRoot, "scripts/x-curation-prepare.mjs"), `--source=${source}`],
      { cwd: repoRoot },
    );
  }
  if (options.fetchOnly) return;

  const enrichArgs = [path.join(repoRoot, "scripts/x-curation-enrich.mjs")];
  if (options.limit !== null) enrichArgs.push("--limit", String(options.limit));
  await execute(process.execPath, enrichArgs, { cwd: repoRoot });
  await execute(
    process.execPath,
    [path.join(repoRoot, "scripts/build-curation-content.mjs")],
    { cwd: repoRoot },
  );
}

export async function runHistoryPipeline({ repoRoot, birdPath, credentials, execute = runCommand }) {
  const rawDir = path.join(repoRoot, "data/sensitive/x-curation/raw");
  const env = { AUTH_TOKEN: credentials.authToken, CT0: credentials.ct0 };
  const sources = [
    { command: "bookmarks", output: "bookmarks-all.json" },
    { command: "likes", output: "likes-all.json" },
  ];

  for (const source of sources) {
    await execute(birdPath, [source.command, "--all", "--json"], {
      cwd: repoRoot,
      env,
      stdoutPath: path.join(rawDir, source.output),
    });
  }
  await execute(
    process.execPath,
    [path.join(repoRoot, "scripts/x-curation-import-bird.mjs")],
    { cwd: repoRoot },
  );
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

选项：
  --source bookmarks|likes|both  抓取来源，默认 both
  --limit <n>                    最多交给 Pi Agent 解析 n 条条目
  --media                        同时抓取媒体元数据
  --fetch-only                   只抓取并写入策展队列，不调用 Pi Agent
  --history                      全量抓取历史书签与点赞并导入策展队列
`);
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

  if (options.history) {
    const curationConfig = JSON.parse(readFileSync(path.join(repoRoot, "config/x-curation.json"), "utf8"));
    await mkdir(path.join(repoRoot, curationConfig.rawDir), { recursive: true });
    const birdPath = process.env.BIRD_PATH ?? path.join(repoRoot, "node_modules/.bin/bird");
    console.log("开始导入全部历史 X 书签与点赞（不调用 Pi Agent）。");
    await runHistoryPipeline({
      repoRoot,
      birdPath,
      credentials: readSmaugCredentials(smaugConfig),
    });
    return;
  }

  if (!options.fetchOnly) {
    const model = resolvePiModelConfig({ env: process.env });
    if (!process.env.KIMI_API_KEY) {
      throw new Error("缺少 KIMI_API_KEY（可写入本项目被忽略的 .env.local）。");
    }
    console.log(`解析运行时：Pi Coding Agent / ${model.provider}/${model.model}`);
  }

  console.log(`开始 X 策展同步：${options.source}${options.fetchOnly ? "（仅抓取）" : "（抓取、Pi Agent 解析并自动公开）"}`);
  await runSyncPipeline({ repoRoot, options });
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(`X 策展同步失败：${error.message}`);
    process.exitCode = 1;
  });
}
