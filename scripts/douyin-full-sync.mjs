#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataRoot = path.join(repoRoot, "data/sensitive/douyin-curation");
const sidecar = path.join(dataRoot, "sidecar");
const manifest = path.join(dataRoot, "downloads/download_manifest.jsonl");

function run(command, args, { cwd = repoRoot, env = {} } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} 退出异常（code=${code ?? "null"}, signal=${signal ?? "none"}）。`));
    });
  });
}

async function pendingVideoCount() {
  try {
    return JSON.parse(await readFile(path.join(dataRoot, "pending-video-urls.json"), "utf8")).length;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}

export function parseFullSyncArgs(args) {
  const options = { analyze: true, analyzeLimit: null, analyzerConcurrency: 6, concurrency: 20, download: true, engine: "codex-cli" };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") continue;
    if (argument === "--discover-only") options.download = options.analyze = false;
    else if (argument === "--skip-download") options.download = false;
    else if (argument === "--skip-analyze") options.analyze = false;
    else if (argument === "--analyze-limit") options.analyzeLimit = Number.parseInt(args[++index], 10);
    else if (argument === "--concurrency") options.concurrency = Number.parseInt(args[++index], 10);
    else if (argument === "--analyzer-concurrency") options.analyzerConcurrency = Number.parseInt(args[++index], 10);
    else if (argument === "--engine") options.engine = args[++index] ?? "";
    else throw new Error(`未知参数：${argument}`);
  }
  if (options.analyzeLimit !== null && (!Number.isInteger(options.analyzeLimit) || options.analyzeLimit < 1)) {
    throw new Error("--analyze-limit 必须是正整数。");
  }
  if (!new Set(["codex-cli", "pi"]).has(options.engine)) throw new Error("--engine 仅支持 codex-cli 或 pi。");
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) throw new Error("--concurrency 必须是正整数。");
  if (!Number.isInteger(options.analyzerConcurrency) || options.analyzerConcurrency < 1) throw new Error("--analyzer-concurrency 必须是正整数。");
  return options;
}

async function main() {
  const options = parseFullSyncArgs(process.argv.slice(2));
  await run("uv", [
    "run",
    "python",
    path.join(repoRoot, "scripts/douyin-favorites-discover.py"),
    "--sidecar",
    sidecar,
    "--data-root",
    dataRoot,
  ], { cwd: sidecar });

  const pending = await pendingVideoCount();
  if (options.download && pending > 0) {
    console.log(`开始下载 ${pending} 条新增收藏视频。`);
    await run("uv", ["run", "douyin-dl", "-c", "config-incremental.yml", "--show-warnings"], { cwd: sidecar });
  }

  if (options.analyze) {
    const args = [
      "douyin:curation", "--", "sync", "--manifest", manifest,
      "--engine", options.engine,
      "--concurrency", String(options.concurrency),
      "--analyzer-concurrency", String(options.analyzerConcurrency),
    ];
    if (options.analyzeLimit !== null) args.push("--limit", String(options.analyzeLimit));
    await run("pnpm", args, {
      env: {
        WHISPER_BIN: path.join(sidecar, ".venv/bin/whisper-ctranslate2"),
        WHISPER_COMPUTE: "int8",
        WHISPER_DEVICE: "cpu",
        WHISPER_LANGUAGE: "zh",
        WHISPER_MODEL: "small",
        OMP_NUM_THREADS: "2",
      },
    });
  }
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(`抖音全量/增量同步失败：${error.message}`);
    process.exitCode = 1;
  });
}
