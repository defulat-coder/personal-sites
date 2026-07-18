#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { accessSync, chmodSync, constants, existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArguments(argv) {
  const parsed = { repo: scriptRoot, ifPresent: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--if-present") {
      parsed.ifPresent = true;
      continue;
    }
    if (argument !== "--repo" || !argv[index + 1]) {
      throw new Error(`未知参数或缺少值：${argument}`);
    }
    parsed.repo = path.resolve(argv[index + 1]);
    index += 1;
  }
  return parsed;
}

function git(root, args) {
  return spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
  });
}

function canonicalPath(value) {
  return realpathSync.native(path.resolve(value));
}

function skip(reason) {
  process.stdout.write(`${JSON.stringify({ activated: false, skipped: true, reason })}\n`);
}

function main() {
  try {
    const args = parseArguments(process.argv.slice(2));
    const rootResult = git(args.repo, ["rev-parse", "--show-toplevel"]);
    const discoveredRoot = rootResult.status === 0 ? canonicalPath(rootResult.stdout.trim()) : null;
    if (discoveredRoot !== canonicalPath(args.repo)) {
      if (args.ifPresent) {
        skip("当前目录不是项目 Git 根目录");
        return;
      }
      throw new Error(rootResult.stderr.trim() || "当前目录不是项目 Git 根目录");
    }

    const hookPath = path.join(args.repo, ".githooks", "pre-push");
    if (!existsSync(hookPath)) {
      if (args.ifPresent) {
        skip("未找到 .githooks/pre-push");
        return;
      }
      throw new Error("未找到 .githooks/pre-push");
    }
    chmodSync(hookPath, 0o755);
    accessSync(hookPath, constants.X_OK);

    const configResult = git(args.repo, ["config", "--local", "core.hooksPath", ".githooks"]);
    if (configResult.status !== 0) {
      throw new Error(configResult.stderr.trim() || "无法配置 core.hooksPath");
    }
    process.stdout.write(`${JSON.stringify({
      activated: true,
      executable: true,
      hooks_path: ".githooks",
      repository: args.repo,
    })}\n`);
  } catch (error) {
    process.stderr.write(`Git hook 安装失败：${error.message}\n`);
    process.exitCode = 1;
  }
}

main();
