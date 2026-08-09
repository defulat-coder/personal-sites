#!/usr/bin/env node
/**
 * Fetch X bookmarks/likes with the local smaug installation, move only the
 * result into the ignored sensitive queue, then analyze drafts with Kimi.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadLocalEnv } from "./lib/load-local-env.mjs";
import { resolveKimiConfig } from "./lib/x-curation-ai.mjs";

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
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
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
}

function printUsage() {
  console.log(`用法：pnpm curation:sync -- [选项]

选项：
  --source bookmarks|likes|both  抓取来源，默认 both
  --limit <n>                    最多交给 Kimi 解析 n 条草稿
  --media                        同时抓取媒体元数据
  --fetch-only                   只抓取并写入待审队列，不调用 Kimi
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

  if (!options.fetchOnly) {
    const kimi = resolveKimiConfig({ env: process.env });
    if (!kimi.apiKey) {
      throw new Error("缺少 KIMI_API_KEY（可写入本项目被忽略的 .env.local）。");
    }
    console.log(`解析模型：Kimi / ${kimi.model}`);
  }

  console.log(`开始 X 策展同步：${options.source}${options.fetchOnly ? "（仅抓取）" : "（抓取并使用 Kimi 解析）"}`);
  await runSyncPipeline({ repoRoot, options });
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(`X 策展同步失败：${error.message}`);
    process.exitCode = 1;
  });
}
