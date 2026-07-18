#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { constants, createReadStream } from "node:fs";
import {
  access,
  chmod,
  copyFile,
  lstat,
  mkdtemp,
  mkdir,
  opendir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  createConversationProjection,
  finalizeConversationProjection,
  historyObjectKey,
  ingestConversationRecord,
  isProjectionCandidateLine,
  normalizeCodexMemoryRow,
  planHistoryUpdate,
  projectionWarning,
} from "./lib/agent-history.mjs";
import { assertRegularFile, resolveInside, sha256 } from "./lib/private-file-integrity.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const execFileAsync = promisify(execFile);
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;
const PROJECTION_REVISION = 3;
const PROJECTION_PREFIX_BYTES = 65536;

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function expandHome(value) {
  const source = String(value ?? "");
  if (source === "~") return os.homedir();
  if (source.startsWith("~/")) return path.join(os.homedir(), source.slice(2));
  return path.resolve(PROJECT_ROOT, source);
}

function posixRelative(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function sourceIdFromPath(platform, kind, sourcePath) {
  return sha256(`${platform}\u0000${kind}\u0000${sourcePath}`).slice(0, 32);
}

function safeTitle(value, fallback) {
  const title = String(value ?? "").replace(/[\u0000-\u001f\u007f]+/gu, " ").replace(/\s+/gu, " ").trim();
  if (!title) return fallback;
  return title.length > 160 ? `${title.slice(0, 159)}…` : title;
}

async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function atomicWrite(file, bytes) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${randomUUID()}`;
  await writeFile(temporary, bytes, { mode: 0o600, flag: "wx" });
  await rename(temporary, file);
}

async function writeContentAddressed(rawRoot, relative, bytes) {
  const target = resolveInside(rawRoot, relative, "content-object");
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  if (await fileExists(target)) {
    const existing = await readFile(target);
    if (!existing.equals(bytes)) throw new Error(`content-address-collision:${relative}`);
    return;
  }
  try {
    await writeFile(target, bytes, { mode: 0o600, flag: "wx" });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = await readFile(target);
    if (!existing.equals(bytes)) throw new Error(`content-address-collision:${relative}`);
  }
}

function sqliteDotPath(file) {
  return `"${file.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

async function readCodexMemoryDatabase(file) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "agent-history-memory-db-"));
  const backupFile = path.join(temporaryRoot, "memories.sqlite");
  try {
    const sourceUri = `${pathToFileURL(file).href}?mode=ro`;
    await execFileAsync("sqlite3", [sourceUri, `.backup ${sqliteDotPath(backupFile)}`], { maxBuffer: 64 * 1024 * 1024 });
    const integrity = await execFileAsync("sqlite3", [backupFile, "PRAGMA journal_mode=DELETE; PRAGMA integrity_check;"], { maxBuffer: 1024 * 1024 });
    if (integrity.stdout.trim().split(/\s+/u).at(-1) !== "ok") throw new Error("codex-memory-database-integrity-failed");
    const query = `SELECT thread_id, source_updated_at, raw_memory, rollout_summary, rollout_slug, generated_at, usage_count, last_usage, selected_for_phase2, selected_for_phase2_source_updated_at FROM stage1_outputs ORDER BY thread_id`;
    const exported = await execFileAsync("sqlite3", ["-json", backupFile, query], { maxBuffer: 64 * 1024 * 1024 });
    const rows = JSON.parse(exported.stdout.trim() || "[]");
    if (!Array.isArray(rows)) throw new Error("codex-memory-database-export-invalid");
    return { backupBytes: await readFile(backupFile), rows };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true }).catch(() => {});
  }
}

async function snapshotPreparedSource(rawRoot, descriptor) {
  if (!Buffer.isBuffer(descriptor.preparedBytes)) throw new Error("prepared-source-bytes-missing");
  if (descriptor.kind === "conversation" || descriptor.kind === "prompt-history") {
    throw new Error("prepared-conversation-not-supported");
  }
  const rawSha = sha256(descriptor.preparedBytes);
  const rawRelative = `blobs/${rawSha.slice(0, 2)}/${rawSha}.blob`;
  await writeContentAddressed(rawRoot, rawRelative, descriptor.preparedBytes);
  return {
    raw: { path: rawRelative, sha256: rawSha, size: descriptor.preparedBytes.length },
    projection: null,
    parsedProjection: null,
    parseState: { invalidRelevantLines: 0, oversizedLines: 0 },
  };
}

async function walkRegularFiles(root, scopeId, warnings) {
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    const stream = await opendir(directory);
    for await (const entry of stream) {
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        warnings.push({ code: "source-symlink-skipped", scope: scopeId, path: posixRelative(root, absolute) });
      } else if (entry.isDirectory()) {
        pending.push(absolute);
      } else if (entry.isFile()) {
        files.push(absolute);
      }
    }
  }
  return files.sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
}

async function loadCodexTitles(file, warnings) {
  const titles = new Map();
  if (!(await fileExists(file))) return titles;
  const source = await readFile(file, "utf8");
  let lineNumber = 0;
  for (const line of source.split("\n")) {
    lineNumber += 1;
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (typeof record.id === "string" && typeof record.thread_name === "string") {
        titles.set(record.id, safeTitle(record.thread_name, `Codex 会话 ${record.id}`));
      }
    } catch {
      warnings.push({ code: "codex-session-index-line-invalid", line: lineNumber });
    }
  }
  return titles;
}

function sessionId(file) {
  return path.basename(file, path.extname(file)).match(UUID_PATTERN)?.[0] ?? null;
}

async function discoverSources(config, previousRecords, warnings, errors) {
  const descriptors = [];
  const failedScopes = new Set();
  const coverage = {
    codex_memory_database: {
      required: true,
      status: "pending",
      stage1_outputs: 0,
    },
  };
  const codexIndexPath = expandHome(config.codex.session_index);
  const codexTitles = await loadCodexTitles(codexIndexPath, warnings).catch((error) => {
    warnings.push({ code: "codex-session-index-read-failed", detail: String(error?.message ?? error).slice(0, 180) });
    return new Map();
  });

  for (const rootConfig of config.codex.session_roots) {
    const root = expandHome(rootConfig.path);
    const scopeId = `codex:${rootConfig.source_prefix}`;
    try {
      for (const file of await walkRegularFiles(root, scopeId, warnings)) {
        if (!file.endsWith(".jsonl")) continue;
        const id = sessionId(file);
        if (!id) {
          warnings.push({ code: "conversation-id-not-found", scope: scopeId, path: posixRelative(root, file) });
          continue;
        }
        descriptors.push({
          platform: "codex",
          kind: "conversation",
          sourceId: id,
          sourcePath: `${rootConfig.source_prefix}/${posixRelative(root, file)}`,
          sourceState: rootConfig.state,
          scopeId,
          absolutePath: file,
          format: "codex-rollout-jsonl",
          titleHint: codexTitles.get(id) ?? null,
        });
      }
    } catch (error) {
      failedScopes.add(scopeId);
      errors.push({ code: "source-scope-scan-failed", scope: scopeId, detail: String(error?.message ?? error).slice(0, 180) });
    }
  }

  if (await fileExists(codexIndexPath)) {
    descriptors.push({
      platform: "codex",
      kind: "index",
      sourceId: "session-index",
      sourcePath: "session_index.jsonl",
      sourceState: "active",
      scopeId: "codex:index",
      absolutePath: codexIndexPath,
      format: "codex-session-index-jsonl",
      titleHint: "Codex 会话索引",
    });
  }

  const codexMemoryDatabase = expandHome(config.codex.memory_database);
  if (!(await fileExists(codexMemoryDatabase))) {
    failedScopes.add("codex:memory-database");
    coverage.codex_memory_database.status = "missing";
    errors.push({ code: "required-source-missing", scope: "codex:memory-database" });
  } else {
    try {
      const database = await readCodexMemoryDatabase(codexMemoryDatabase);
      descriptors.push({
        platform: "codex",
        kind: "index",
        sourceId: "memory-database",
        sourcePath: "memories_1.sqlite",
        sourceState: "active",
        scopeId: "codex:memory-database",
        preparedBytes: database.backupBytes,
        sourceMtimeMs: 0,
        format: "sqlite3-backup",
        titleHint: "Codex 记忆数据库一致性快照",
        sourceMetadata: { databaseRows: database.rows.length },
      });
      const rowIds = new Set();
      for (const sourceRow of database.rows) {
        const row = normalizeCodexMemoryRow(sourceRow);
        if (rowIds.has(row.rawObject.thread_id)) throw new Error(`codex-memory-database-thread-duplicate:${row.rawObject.thread_id}`);
        rowIds.add(row.rawObject.thread_id);
        descriptors.push({
          platform: "codex",
          kind: "memory",
          sourceId: sourceIdFromPath("codex", "memory", row.sourcePath),
          sourcePath: row.sourcePath,
          sourceState: "active",
          scopeId: "codex:memory-database",
          preparedBytes: Buffer.from(stableJson(row.rawObject), "utf8"),
          sourceMtimeMs: row.rawObject.source_updated_at * 1000,
          format: "codex-memory-stage1-json",
          titleHint: row.title,
          sourceMetadata: row.metadata,
        });
      }
      coverage.codex_memory_database = {
        required: true,
        status: "complete",
        stage1_outputs: database.rows.length,
      };
    } catch (error) {
      failedScopes.add("codex:memory-database");
      coverage.codex_memory_database.status = "failed";
      errors.push({ code: "source-scope-scan-failed", scope: "codex:memory-database", detail: String(error?.message ?? error).slice(0, 180) });
    }
  }

  const codexMemoryRoot = expandHome(config.codex.memory_root);
  try {
    const excludes = new Set(config.codex.memory_excludes ?? []);
    for (const file of await walkRegularFiles(codexMemoryRoot, "codex:memories", warnings)) {
      const relative = posixRelative(codexMemoryRoot, file);
      const segments = relative.split("/");
      if (segments.some((segment) => excludes.has(segment))) continue;
      if (!/[.](?:md|jsonl|json|txt)$/iu.test(file)) continue;
      const sourcePath = `memories/${relative}`;
      descriptors.push({
        platform: "codex",
        kind: "memory",
        sourceId: sourceIdFromPath("codex", "memory", sourcePath),
        sourcePath,
        sourceState: "active",
        scopeId: "codex:memories",
        absolutePath: file,
        format: path.extname(file).slice(1).toLowerCase() || "text",
        titleHint: safeTitle(path.basename(file, path.extname(file)).replaceAll("_", " "), relative),
      });
    }
  } catch (error) {
    failedScopes.add("codex:memories");
    errors.push({ code: "source-scope-scan-failed", scope: "codex:memories", detail: String(error?.message ?? error).slice(0, 180) });
  }

  const claudeProjectsRoot = expandHome(config.claude_code.projects_root);
  try {
    for (const file of await walkRegularFiles(claudeProjectsRoot, "claude-code:projects", warnings)) {
      const relative = posixRelative(claudeProjectsRoot, file);
      const basename = path.basename(file);
      if (file.endsWith(".jsonl")) {
        const id = sessionId(file);
        if (!id) continue;
        descriptors.push({
          platform: "claude-code",
          kind: "conversation",
          sourceId: id,
          sourcePath: `projects/${relative}`,
          sourceState: "active",
          scopeId: "claude-code:projects",
          absolutePath: file,
          format: "claude-code-session-jsonl",
          titleHint: null,
        });
      } else if (basename === "sessions-index.json") {
        const sourcePath = `projects/${relative}`;
        descriptors.push({
          platform: "claude-code",
          kind: "index",
          sourceId: sourceIdFromPath("claude-code", "index", sourcePath),
          sourcePath,
          sourceState: "active",
          scopeId: "claude-code:projects",
          absolutePath: file,
          format: "claude-code-session-index-json",
          titleHint: "Claude Code 会话索引",
        });
      } else if (file.endsWith(".md") && (relative.split("/").includes("memory") || basename === "MEMORY.md")) {
        const sourcePath = `projects/${relative}`;
        descriptors.push({
          platform: "claude-code",
          kind: "memory",
          sourceId: sourceIdFromPath("claude-code", "memory", sourcePath),
          sourcePath,
          sourceState: "active",
          scopeId: "claude-code:projects",
          absolutePath: file,
          format: "markdown",
          titleHint: safeTitle(path.basename(file, path.extname(file)), relative),
        });
      }
    }
  } catch (error) {
    failedScopes.add("claude-code:projects");
    errors.push({ code: "source-scope-scan-failed", scope: "claude-code:projects", detail: String(error?.message ?? error).slice(0, 180) });
  }

  const promptHistory = expandHome(config.claude_code.prompt_history);
  if (await fileExists(promptHistory)) {
    descriptors.push({
      platform: "claude-code",
      kind: "prompt-history",
      sourceId: "global-prompt-history",
      sourcePath: "history.jsonl",
      sourceState: "active",
      scopeId: "claude-code:prompt-history",
      absolutePath: promptHistory,
      format: "claude-code-prompt-history-jsonl",
      titleHint: "Claude Code 全局提示历史",
    });
  }

  const claudeMetadataRoot = expandHome(config.claude_code.session_metadata_root);
  if (await fileExists(claudeMetadataRoot)) {
    try {
      for (const file of await walkRegularFiles(claudeMetadataRoot, "claude-code:session-metadata", warnings)) {
        if (!file.endsWith(".json")) continue;
        const sourcePath = `sessions/${posixRelative(claudeMetadataRoot, file)}`;
        descriptors.push({
          platform: "claude-code",
          kind: "index",
          sourceId: sourceIdFromPath("claude-code", "index", sourcePath),
          sourcePath,
          sourceState: "active",
          scopeId: "claude-code:session-metadata",
          absolutePath: file,
          format: "claude-code-session-metadata-json",
          titleHint: "Claude Code 当前会话元数据",
        });
      }
    } catch (error) {
      failedScopes.add("claude-code:session-metadata");
      errors.push({ code: "source-scope-scan-failed", scope: "claude-code:session-metadata", detail: String(error?.message ?? error).slice(0, 180) });
    }
  }

  for (const configured of config.claude_code.global_memory_files ?? []) {
    const file = expandHome(configured);
    if (!(await fileExists(file))) continue;
    const sourcePath = `global/${path.basename(file)}`;
    descriptors.push({
      platform: "claude-code",
      kind: "memory",
      sourceId: sourceIdFromPath("claude-code", "memory", sourcePath),
      sourcePath,
      sourceState: "active",
      scopeId: "claude-code:global-memory",
      absolutePath: file,
      format: "markdown",
      titleHint: "Claude Code 全局上下文",
    });
  }

  const deduplicated = new Map();
  const priority = (descriptor) => descriptor.sourceState === "active" ? 2 : 1;
  for (const descriptor of descriptors) {
    const key = historyObjectKey(descriptor);
    const existing = deduplicated.get(key);
    if (!existing || priority(descriptor) > priority(existing)) deduplicated.set(key, descriptor);
    else warnings.push({ code: "duplicate-source-identity", platform: descriptor.platform, kind: descriptor.kind, source_id: descriptor.sourceId });
  }
  for (const previous of previousRecords) {
    if (failedScopes.has(previous.metadata?.scopeId) && previous.active && !deduplicated.has(historyObjectKey(previous))) {
      deduplicated.set(historyObjectKey(previous), { retainedRecord: previous });
    }
  }
  return {
    descriptors: [...deduplicated.values()].sort((left, right) => historyObjectKey(left.retainedRecord ?? left).localeCompare(historyObjectKey(right.retainedRecord ?? right))),
    coverage,
  };
}

function ingestProjectedLine(projection, platform, kind, line, parseState) {
  if (!line.trim() || !isProjectionCandidateLine(platform, kind, line)) return;
  try {
    const record = JSON.parse(line);
    if (kind === "prompt-history") {
      ingestConversationRecord(projection, {
        type: "user",
        timestamp: Number(record.timestamp),
        cwd: record.project,
        message: { role: "user", content: record.display },
      });
    } else {
      ingestConversationRecord(projection, record);
    }
  } catch {
    parseState.invalidRelevantLines += 1;
  }
}

async function hashAndProject(file, descriptor, maxLineBytes) {
  const digest = createHash("sha256");
  const projection = ["conversation", "prompt-history"].includes(descriptor.kind)
    ? createConversationProjection({ platform: descriptor.platform, sourceId: descriptor.sourceId, titleHint: descriptor.titleHint })
    : null;
  const parseState = { invalidRelevantLines: 0, oversizedLines: 0 };
  let totalBytes = 0;
  let lineParts = [];
  let lineBytes = 0;
  let prefixParts = [];
  let prefixBytes = 0;
  let oversized = false;

  const append = (part) => {
    if (part.length === 0) return;
    if (prefixBytes < PROJECTION_PREFIX_BYTES) {
      const prefixPart = part.subarray(0, PROJECTION_PREFIX_BYTES - prefixBytes);
      prefixParts.push(prefixPart);
      prefixBytes += prefixPart.length;
    }
    if (oversized) return;
    if (lineBytes + part.length > maxLineBytes) {
      oversized = true;
      lineParts = [];
      lineBytes = 0;
      return;
    }
    lineParts.push(part);
    lineBytes += part.length;
  };
  const finishLine = () => {
    if (oversized && projection) {
      const prefix = Buffer.concat(prefixParts, prefixBytes).toString("utf8");
      if (isProjectionCandidateLine(descriptor.platform, descriptor.kind, prefix)) parseState.oversizedLines += 1;
    } else if (projection && lineBytes > 0) {
      ingestProjectedLine(projection, descriptor.platform, descriptor.kind, Buffer.concat(lineParts, lineBytes).toString("utf8"), parseState);
    }
    lineParts = [];
    lineBytes = 0;
    prefixParts = [];
    prefixBytes = 0;
    oversized = false;
  };

  for await (const chunk of createReadStream(file)) {
    digest.update(chunk);
    totalBytes += chunk.length;
    let start = 0;
    while (start < chunk.length) {
      const newline = chunk.indexOf(10, start);
      if (newline < 0) {
        append(chunk.subarray(start));
        break;
      }
      append(chunk.subarray(start, newline));
      finishLine();
      start = newline + 1;
    }
  }
  if (lineBytes > 0 || oversized) finishLine();
  return {
    sha256: digest.digest("hex"),
    size: totalBytes,
    projection: projection ? finalizeConversationProjection(projection) : null,
    parseState,
  };
}

async function snapshotSource(rawRoot, descriptor, maxLineBytes) {
  const temporaryDirectory = resolveInside(rawRoot, ".staging", "staging");
  await mkdir(temporaryDirectory, { recursive: true, mode: 0o700 });
  const temporary = path.join(temporaryDirectory, `${randomUUID()}.snapshot`);
  await copyFile(descriptor.absolutePath, temporary, constants.COPYFILE_FICLONE);
  await chmod(temporary, 0o600);
  try {
    const result = await hashAndProject(temporary, descriptor, maxLineBytes);
    const rawRelative = `blobs/${result.sha256.slice(0, 2)}/${result.sha256}.blob`;
    const rawTarget = resolveInside(rawRoot, rawRelative, "raw-blob");
    await mkdir(path.dirname(rawTarget), { recursive: true, mode: 0o700 });
    if (await fileExists(rawTarget)) {
      const details = await stat(rawTarget);
      if (details.size !== result.size) throw new Error(`raw-blob-size-collision:${result.sha256}`);
      await rm(temporary, { force: true });
    } else {
      await rename(temporary, rawTarget);
    }
    let projectionReference = null;
    if (result.projection) {
      const projectionBytes = Buffer.from(stableJson(result.projection), "utf8");
      const projectionSha = sha256(projectionBytes);
      const projectionRelative = `objects/${descriptor.platform}/${descriptor.kind}/${descriptor.sourceId}/${projectionSha}.json`;
      await writeContentAddressed(rawRoot, projectionRelative, projectionBytes);
      projectionReference = { path: projectionRelative, sha256: projectionSha, size: projectionBytes.length };
    }
    return {
      raw: { path: rawRelative, sha256: result.sha256, size: result.size },
      projection: projectionReference,
      parsedProjection: result.projection,
      parseState: result.parseState,
    };
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function loadPrevious(rawRoot) {
  const manifestFile = resolveInside(rawRoot, "manifest.json", "manifest");
  if (!(await fileExists(manifestFile))) return { manifest: null, bytes: null, records: [] };
  await assertRegularFile(manifestFile, rawRoot, "manifest");
  const bytes = await readFile(manifestFile);
  const manifest = JSON.parse(bytes.toString("utf8"));
  if (manifest.schema_version !== "1.0.0" || manifest.source_system !== "agent-history") {
    throw new Error("agent-history-manifest-schema-unsupported");
  }
  return { manifest, bytes, records: manifest.objects ?? [] };
}

async function reusableRecord(previous, descriptor, sourceStats, rawRoot) {
  if (!previous?.active) return null;
  if (previous.metadata?.sourceSize !== sourceStats.size || previous.metadata?.sourceMtimeMs !== sourceStats.mtimeMs) return null;
  if (!(await fileExists(resolveInside(rawRoot, previous.raw.path, "raw-blob")))) return null;
  if (previous.projection) {
    const diagnostics = previous.metadata?.projectionDiagnostics;
    if (!Number.isSafeInteger(diagnostics?.invalidRelevantLines) || !Number.isSafeInteger(diagnostics?.oversizedLines)) return null;
    if (previous.metadata?.projectionRevision !== PROJECTION_REVISION) return null;
    if (!(await fileExists(resolveInside(rawRoot, previous.projection.path, "projection")))) return null;
  }
  return {
    ...previous,
    sourcePath: descriptor.sourcePath,
    sourceState: descriptor.sourceState,
    metadata: {
      ...previous.metadata,
      scopeId: descriptor.scopeId,
      sourceSize: sourceStats.size,
      sourceMtimeMs: sourceStats.mtimeMs,
      format: descriptor.format,
    },
  };
}

function countsFor(records) {
  const active = records.filter((record) => record.active);
  const count = (platform, kind) => active.filter((record) => record.platform === platform && record.kind === kind).length;
  return {
    objects: records.length,
    active: active.length,
    inactive: records.length - active.length,
    conversations: active.filter((record) => record.kind === "conversation").length,
    memories: active.filter((record) => record.kind === "memory").length,
    indexes: active.filter((record) => record.kind === "index").length,
    prompt_histories: active.filter((record) => record.kind === "prompt-history").length,
    codex_conversations: count("codex", "conversation"),
    codex_memories: count("codex", "memory"),
    codex_memory_database_rows: active.filter((record) => record.platform === "codex" && record.kind === "memory" && record.metadata?.format === "codex-memory-stage1-json").length,
    codex_memory_database_snapshots: active.filter((record) => record.platform === "codex" && record.kind === "index" && record.sourceId === "memory-database").length,
    claude_code_conversations: count("claude-code", "conversation"),
    claude_code_memories: count("claude-code", "memory"),
    raw_bytes: active.reduce((total, record) => total + Number(record.raw?.size ?? 0), 0),
    messages: active.reduce((total, record) => total + Number(record.metadata?.messageCounts?.messages ?? 0), 0),
  };
}

async function main() {
  if (process.argv.slice(2).length > 0) throw new Error("unexpected-arguments");
  const configFile = resolveInside(PROJECT_ROOT, "config/agent-history-sync.json", "config");
  const config = JSON.parse(await readFile(configFile, "utf8"));
  if (config.schema_version !== "1.0.0" || config.source_system !== "agent-history") {
    throw new Error("agent-history-config-unsupported");
  }
  if (typeof config.codex?.memory_database !== "string" || config.codex.memory_database.length === 0) {
    throw new Error("agent-history-codex-memory-database-config-missing");
  }
  const rawRoot = resolveInside(PROJECT_ROOT, config.storage?.raw_root, "raw-root");
  const privateRelative = path.relative(PROJECT_ROOT, rawRoot);
  if (!privateRelative.startsWith(`data${path.sep}private${path.sep}`)) throw new Error("agent-history-raw-root-must-be-private");
  await mkdir(rawRoot, { recursive: true, mode: 0o700 });
  const maxLineBytes = Number(config.projection?.max_jsonl_line_bytes ?? 8388608);
  if (!Number.isSafeInteger(maxLineBytes) || maxLineBytes < 1024) throw new Error("agent-history-max-line-bytes-invalid");

  const observedAt = new Date().toISOString();
  const previous = await loadPrevious(rawRoot);
  const previousByKey = new Map(previous.records.map((record) => [historyObjectKey(record), record]));
  const warnings = [];
  const errors = [];
  const discovered = await discoverSources(config, previous.records, warnings, errors);
  const { descriptors, coverage } = discovered;
  const current = [];
  let scannedBytes = 0;
  let reused = 0;
  let processed = 0;
  for (const descriptor of descriptors) {
    if (descriptor.retainedRecord) {
      current.push(descriptor.retainedRecord);
      processed += 1;
      continue;
    }
    const key = historyObjectKey(descriptor);
    const previousRecord = previousByKey.get(key);
    try {
      let signature;
      if (descriptor.preparedBytes) {
        signature = { size: descriptor.preparedBytes.length, mtimeMs: descriptor.sourceMtimeMs ?? 0 };
      } else {
        const details = await lstat(descriptor.absolutePath);
        if (!details.isFile() || details.isSymbolicLink()) throw new Error("source-not-regular-file");
        signature = {
          size: details.size,
          mtimeMs: Math.round(details.mtimeMs * 1000) / 1000,
        };
      }
      const reusable = descriptor.preparedBytes ? null : await reusableRecord(previousRecord, descriptor, signature, rawRoot);
      if (reusable) {
        current.push(reusable);
        reused += 1;
      } else {
        const snapshot = descriptor.preparedBytes
          ? await snapshotPreparedSource(rawRoot, descriptor)
          : await snapshotSource(rawRoot, descriptor, maxLineBytes);
        scannedBytes += snapshot.raw.size;
        const projection = snapshot.parsedProjection;
        current.push({
          platform: descriptor.platform,
          kind: descriptor.kind,
          sourceId: descriptor.sourceId,
          sourcePath: descriptor.sourcePath,
          sourceState: descriptor.sourceState,
          raw: snapshot.raw,
          projection: snapshot.projection,
          title: projection?.title ?? descriptor.titleHint,
          metadata: {
            scopeId: descriptor.scopeId,
            sourceSize: signature.size,
            sourceMtimeMs: signature.mtimeMs,
            format: descriptor.format,
            cwd: projection?.cwd ?? null,
            gitBranch: projection?.gitBranch ?? null,
            parentSessionId: projection?.parentSessionId ?? null,
            createdAt: projection?.createdAt ?? null,
            updatedAt: projection?.updatedAt ?? null,
            messageCounts: projection?.counts ?? null,
            projectionDiagnostics: projection ? snapshot.parseState : null,
            projectionRevision: projection ? PROJECTION_REVISION : null,
            ...descriptor.sourceMetadata,
          },
          active: true,
          firstSeenAt: null,
          lastChangedAt: null,
          inactiveSince: null,
        });
      }
    } catch (error) {
      errors.push({
        code: "source-file-snapshot-failed",
        platform: descriptor.platform,
        kind: descriptor.kind,
        source_id: descriptor.sourceId,
        detail: String(error?.message ?? error).slice(0, 180),
      });
      if (previousRecord?.active) current.push(previousRecord);
    }
    processed += 1;
    if (processed % 25 === 0 || processed === descriptors.length) {
      process.stderr.write(`[agent-history-sync] progress=${processed}/${descriptors.length} reused=${reused} scanned_gib=${(scannedBytes / 1073741824).toFixed(2)}\n`);
    }
  }

  for (const record of current) {
    const warning = projectionWarning(record);
    if (warning) warnings.push(warning);
  }

  const issueOrder = (left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right));
  warnings.sort(issueOrder);
  errors.sort(issueOrder);
  const planned = planHistoryUpdate({ current, previous: previous.records, observedAt });
  const counts = countsFor(planned.records);
  const complete = errors.length === 0;
  const noChange = Boolean(previous.manifest)
    && planned.changes.length === 0
    && previous.manifest.complete === complete
    && JSON.stringify(previous.manifest.warnings) === JSON.stringify(warnings)
    && JSON.stringify(previous.manifest.errors) === JSON.stringify(errors)
    && JSON.stringify(previous.manifest.counts) === JSON.stringify(counts)
    && JSON.stringify(previous.manifest.coverage) === JSON.stringify(coverage);

  if (noChange) {
    const manifestSha = sha256(previous.bytes);
    await atomicWrite(resolveInside(rawRoot, "state.json", "state"), stableJson({
      schema_version: "1.0.0",
      source_system: "agent-history",
      last_checked_at: observedAt,
      last_changed_at: previous.manifest.snapshot_at,
      last_check_changed: false,
      manifest_sha256: manifestSha,
      complete,
    }));
    process.stdout.write(`${JSON.stringify({ synced: true, changed: false, complete, manifest_sha256: manifestSha, reused, scanned_bytes: scannedBytes, ...counts })}\n`);
    return;
  }

  const manifest = {
    schema_version: "1.0.0",
    source_system: "agent-history",
    snapshot_at: observedAt,
    complete,
    projection_policy: {
      raw_files_complete: true,
      readable_roles: ["user", "assistant"],
      excluded_from_okf: ["developer-messages", "system-messages", "reasoning", "tool-calls", "tool-results", "binary-content"],
      max_jsonl_line_bytes: maxLineBytes,
      revision: PROJECTION_REVISION,
    },
    coverage,
    counts,
    objects: planned.records,
    changes: planned.changes,
    warnings,
    errors,
  };
  const manifestBytes = Buffer.from(stableJson(manifest), "utf8");
  const manifestSha = sha256(manifestBytes);
  await atomicWrite(resolveInside(rawRoot, "manifest.json", "manifest"), manifestBytes);
  if (config.retention?.keep_snapshot_history !== false) {
    const snapshotName = observedAt.replace(/[:.]/gu, "-");
    await atomicWrite(resolveInside(rawRoot, `snapshots/${snapshotName}.json`, "snapshot"), manifestBytes);
  }
  await atomicWrite(resolveInside(rawRoot, "state.json", "state"), stableJson({
    schema_version: "1.0.0",
    source_system: "agent-history",
    last_checked_at: observedAt,
    last_changed_at: observedAt,
    last_check_changed: true,
    manifest_sha256: manifestSha,
    complete,
  }));
  process.stdout.write(`${JSON.stringify({
    synced: true,
    changed: true,
    complete,
    manifest_sha256: manifestSha,
    changes: planned.changes.length,
    warnings: warnings.length,
    errors: errors.length,
    reused,
    scanned_bytes: scannedBytes,
    ...counts,
  })}\n`);
  if (!complete) process.exitCode = 2;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  main().catch((error) => {
    const reason = String(error?.message ?? error ?? "unknown").replace(/[\r\n]+/gu, " ").slice(0, 240);
    process.stderr.write(`[agent-history-sync] fatal=${JSON.stringify(reason)}\n`);
    process.exitCode = 1;
  });
}

export { main };
