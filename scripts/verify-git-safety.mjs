#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArguments(argv) {
  const parsed = { repo: scriptRoot, config: null, range: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument !== "--repo" && argument !== "--config" && argument !== "--range") {
      throw new Error(`未知参数：${argument}`);
    }
    const value = argv[index + 1];
    if (!value) {
      throw new Error(`参数 ${argument} 缺少值`);
    }
    parsed[argument.slice(2)] = value;
    index += 1;
  }
  parsed.repo = path.resolve(parsed.repo);
  parsed.config = path.resolve(parsed.config ?? path.join(parsed.repo, "config", "git-safety.json"));
  return parsed;
}

function parseNullSeparated(output) {
  return output.split("\0").filter(Boolean);
}

function git(root, args, options = {}) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

function normalizeGitPath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
}

function validateStringArray(config, key) {
  const value = config[key] ?? [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`${key} 必须是非空字符串数组`);
  }
  return value.map(normalizeGitPath);
}

function loadConfig(configPath) {
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  for (const key of ["max_regular_git_file_bytes", "github_hard_limit_bytes"]) {
    if (!Number.isSafeInteger(config[key]) || config[key] <= 0) {
      throw new Error(`${key} 必须是正整数`);
    }
  }
  if (config.github_hard_limit_bytes < config.max_regular_git_file_bytes) {
    throw new Error("github_hard_limit_bytes 不能小于 max_regular_git_file_bytes");
  }
  return {
    ...config,
    blocked_directories: validateStringArray(config, "blocked_directories"),
    blocked_directory_names: validateStringArray(config, "blocked_directory_names"),
    blocked_files: validateStringArray(config, "blocked_files"),
    blocked_filename_prefixes: validateStringArray(config, "blocked_filename_prefixes"),
    blocked_filename_suffixes: validateStringArray(config, "blocked_filename_suffixes"),
    allowed_files: validateStringArray(config, "allowed_files"),
    required_ignored_paths: validateStringArray(config, "required_ignored_paths"),
  };
}

function pathIsBlocked(filePath, config) {
  const normalized = normalizeGitPath(filePath);
  if (config.allowed_files.includes(normalized)) {
    return false;
  }
  if (config.blocked_files.includes(normalized)) {
    return true;
  }
  if (config.blocked_directories.some((directory) => (
    normalized === directory || normalized.startsWith(`${directory}/`)
  ))) {
    return true;
  }
  if (config.blocked_directory_names.some((directory) => (
    normalized === directory
      || normalized.startsWith(`${directory}/`)
      || normalized.includes(`/${directory}/`)
  ))) {
    return true;
  }
  const filename = path.posix.basename(normalized);
  return config.blocked_filename_prefixes.some((prefix) => filename.startsWith(prefix))
    || config.blocked_filename_suffixes.some((suffix) => filename.endsWith(suffix));
}

function trackedIndexEntries(root) {
  return parseNullSeparated(git(root, ["ls-files", "--stage", "-z"])).map((entry) => {
    const match = entry.match(/^(\d+) ([0-9a-f]+) (\d+)\t([\s\S]+)$/);
    if (!match) {
      throw new Error("无法解析 Git 索引条目");
    }
    return {
      mode: match[1],
      objectId: match[2],
      stage: Number(match[3]),
      path: normalizeGitPath(match[4]),
    };
  });
}

function blobSizes(root, objectIds) {
  const uniqueIds = [...new Set(objectIds)];
  if (uniqueIds.length === 0) {
    return new Map();
  }
  const output = git(root, ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], {
    input: `${uniqueIds.join("\n")}\n`,
  });
  const sizes = new Map();
  for (const line of output.trim().split("\n")) {
    const [objectId, objectType, rawSize] = line.split(" ");
    if (objectType !== "blob") {
      throw new Error(`索引对象 ${objectId} 不是 blob`);
    }
    sizes.set(objectId, Number(rawSize));
  }
  return sizes;
}

function isGitlink(entry) {
  return entry.mode === "160000";
}

function worktreeFileSize(root, filePath) {
  try {
    const stat = lstatSync(path.join(root, filePath));
    return stat.isFile() ? stat.size : null;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function sizeViolation(filePath, size, config) {
  if (size > config.github_hard_limit_bytes) {
    return `${filePath}（${size} bytes）：超过 GitHub 100 MiB 硬限制`;
  }
  if (size > config.max_regular_git_file_bytes) {
    return `${filePath}（${size} bytes）：超过常规 Git 上限 ${config.max_regular_git_file_bytes} bytes`;
  }
  return null;
}

function addViolation(violations, key, message) {
  if (!violations.has(key)) {
    violations.set(key, message);
  }
}

function ignoredByGit(root, filePath) {
  const result = spawnSync("git", ["check-ignore", "--quiet", "--no-index", "--", filePath], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr.trim() || `git check-ignore 失败：${filePath}`);
  }
  return result.status === 0;
}

function auditWorktreePath({ root, filePath, config, violations }) {
  if (pathIsBlocked(filePath, config)) {
    addViolation(violations, `blocked:${filePath}`, `${filePath}：禁止进入 Git`);
  }
  const size = worktreeFileSize(root, filePath);
  if (size === null) {
    return null;
  }
  const problem = sizeViolation(filePath, size, config);
  if (problem) {
    addViolation(violations, `size:${filePath}`, problem);
  }
  return size;
}

function historyTreeEntries(root, revisionSpec) {
  if (revisionSpec.startsWith("-") || revisionSpec.includes("\0") || revisionSpec.includes("\n")) {
    throw new Error("--range 必须是单个 Git revision 或 revision range");
  }
  const revisionOutput = git(root, ["rev-list", "--reverse", revisionSpec, "--"]).trim();
  const commits = revisionOutput ? revisionOutput.split("\n") : [];
  const uniqueEntries = new Map();
  for (const commit of commits) {
    const treeOutput = git(root, ["ls-tree", "-r", "-z", "--full-tree", commit]);
    for (const rawEntry of parseNullSeparated(treeOutput)) {
      const match = rawEntry.match(/^(\d+) (\w+) ([0-9a-f]+)\t([\s\S]+)$/);
      if (!match) {
        throw new Error(`无法解析提交 ${commit} 的 Git tree`);
      }
      if (match[2] !== "blob") {
        continue;
      }
      const entry = {
        objectId: match[3],
        path: normalizeGitPath(match[4]),
      };
      uniqueEntries.set(`${entry.objectId}\0${entry.path}`, entry);
    }
  }
  return { commits, entries: [...uniqueEntries.values()] };
}

function auditHistory(root, revisionSpec, config, violations) {
  if (!revisionSpec) {
    return { commits: 0, objects: 0 };
  }
  const history = historyTreeEntries(root, revisionSpec);
  const sizes = blobSizes(root, history.entries.map((entry) => entry.objectId));
  for (const entry of history.entries) {
    const objectLabel = entry.objectId.slice(0, 12);
    if (pathIsBlocked(entry.path, config)) {
      addViolation(
        violations,
        `history-blocked:${entry.path}:${entry.objectId}`,
        `${entry.path}（${objectLabel}）：历史对象禁止进入 Git`,
      );
    }
    const problem = sizeViolation(entry.path, sizes.get(entry.objectId) ?? 0, config);
    if (problem) {
      addViolation(
        violations,
        `history-size:${entry.path}:${entry.objectId}`,
        `${problem}（历史对象 ${objectLabel}）`,
      );
    }
  }
  return { commits: history.commits.length, objects: history.entries.length };
}

function auditRepository(root, config, revisionSpec) {
  git(root, ["rev-parse", "--is-inside-work-tree"]);
  const entries = trackedIndexEntries(root);
  const stageZeroEntries = entries.filter((entry) => entry.stage === 0);
  const blobEntries = stageZeroEntries.filter((entry) => !isGitlink(entry));
  const sizes = blobSizes(root, blobEntries.map((entry) => entry.objectId));
  const untrackedPaths = parseNullSeparated(git(root, ["ls-files", "--others", "--exclude-standard", "-z"]));
  const violations = new Map();
  let trackedBytes = 0;
  let untrackedCandidateBytes = 0;
  let largestRegularGitBlobBytes = 0;

  const requiredIgnoredPaths = [
    ...config.blocked_directories.map((directory) => `${directory}/.git-safety-probe`),
    ...config.blocked_directory_names.map(
      (directory) => `.git-safety-nested/${directory}/.git-safety-probe`,
    ),
    ...config.required_ignored_paths,
  ];
  for (const requiredPath of new Set(requiredIgnoredPaths)) {
    if (!ignoredByGit(root, requiredPath)) {
      addViolation(
        violations,
        `ignore:${requiredPath}`,
        `${requiredPath}：未被 .gitignore 覆盖`,
      );
    }
  }

  for (const entry of stageZeroEntries) {
    auditWorktreePath({ root, filePath: entry.path, config, violations });
    if (isGitlink(entry)) {
      continue;
    }
    const indexSize = sizes.get(entry.objectId) ?? 0;
    trackedBytes += indexSize;
    largestRegularGitBlobBytes = Math.max(largestRegularGitBlobBytes, indexSize);
    const indexSizeProblem = sizeViolation(entry.path, indexSize, config);
    if (indexSizeProblem) {
      addViolation(violations, `size:${entry.path}`, indexSizeProblem);
    }
  }

  for (const filePath of untrackedPaths) {
    const normalized = normalizeGitPath(filePath);
    const size = auditWorktreePath({ root, filePath: normalized, config, violations });
    if (size === null) {
      continue;
    }
    untrackedCandidateBytes += size;
  }

  const history = auditHistory(root, revisionSpec, config, violations);

  return {
    violations: [...violations.values()],
    trackedFiles: stageZeroEntries.length,
    untrackedCandidates: untrackedPaths.length,
    trackedBytes,
    untrackedCandidateBytes,
    largestRegularGitBlobBytes,
    historyCommits: history.commits,
    historyObjects: history.objects,
  };
}

function main() {
  try {
    const args = parseArguments(process.argv.slice(2));
    const config = loadConfig(args.config);
    const audit = auditRepository(args.repo, config, args.range);
    const report = {
      verified: audit.violations.length === 0,
      violations: audit.violations.length,
      tracked_files: audit.trackedFiles,
      untracked_candidates: audit.untrackedCandidates,
      tracked_bytes: audit.trackedBytes,
      untracked_candidate_bytes: audit.untrackedCandidateBytes,
      largest_regular_git_blob_bytes: audit.largestRegularGitBlobBytes,
      history_commits: audit.historyCommits,
      history_objects: audit.historyObjects,
      max_regular_git_file_bytes: config.max_regular_git_file_bytes,
      github_hard_limit_bytes: config.github_hard_limit_bytes,
      private_raw_scanned: false,
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (audit.violations.length > 0) {
      process.stderr.write(`Git 安全检查失败（${audit.violations.length} 项）：\n`);
      for (const violation of audit.violations) {
        process.stderr.write(`- ${violation}\n`);
      }
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`Git 安全检查无法完成：${error.message}\n`);
    process.exitCode = 2;
  }
}

main();
