#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function resolveInside(root, child, label) {
  const resolved = path.resolve(root, child);
  const relative = path.relative(root, resolved);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label}-outside-root`);
  }
  return resolved;
}

async function assertRegularFile(file, root) {
  resolveInside(root, path.relative(root, file), "input");
  const details = await lstat(file);
  if (!details.isFile() || details.isSymbolicLink()) throw new Error("input-not-regular-file");
}

function yamlScalar(value) {
  return JSON.stringify(String(value));
}

function yamlValue(value) {
  if (Array.isArray(value)) return `[${value.map(yamlScalar).join(", ")}]`;
  if (typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  return yamlScalar(value);
}

function frontmatter(fields) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") continue;
    lines.push(`${key}: ${yamlValue(value)}`);
  }
  lines.push("---", "");
  return `${lines.join("\n")}\n`;
}

function inlineText(value, fallback, limit = 180) {
  const text = String(value ?? "")
    .replace(/<[^>]*>/gu, " ")
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (!text) return fallback;
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

function markdownText(value) {
  return String(value).replace(/([\\[\]])/gu, "\\$1").replace(/\s+/gu, " ").trim();
}

function numericId(value, label) {
  const id = String(value ?? "");
  if (!/^\d+$/u.test(id)) throw new Error(`${label}-must-be-numeric`);
  return id;
}

function isoTimestamp(...values) {
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) continue;
    const milliseconds = Date.parse(value);
    if (Number.isFinite(milliseconds)) return new Date(milliseconds).toISOString();
  }
  return "1970-01-01T00:00:00.000Z";
}

function isUri(value) {
  try {
    const parsed = new URL(value);
    return Boolean(parsed.protocol);
  } catch {
    return false;
  }
}

function recordByKind(manifest, kind) {
  return manifest.objects
    .filter((record) => record.kind === kind)
    .sort((left, right) => String(left.source_id).localeCompare(String(right.source_id), "en", { numeric: true }));
}

async function readRawObject(rawRoot, record) {
  if (!record || typeof record.path !== "string" || !/^[a-f0-9]{64}$/u.test(record.sha256 ?? "")) {
    throw new Error("invalid-manifest-object");
  }
  const file = resolveInside(rawRoot, record.path, "object");
  await assertRegularFile(file, rawRoot);
  const bytes = await readFile(file);
  if (sha256(bytes) !== record.sha256) throw new Error("object-hash-mismatch");
  return JSON.parse(bytes.toString("utf8"));
}

async function writeUtf8(root, relative, body) {
  const target = resolveInside(root, relative, "output");
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await writeFile(target, body, { encoding: "utf8", mode: 0o600, flag: "wx" });
}

function concept(fields, title, body, provenanceLine) {
  const sourceBody = String(body ?? "").trim();
  const content = sourceBody || "_源对象没有可用的文本正文。_";
  return `${frontmatter(fields)}# ${title}\n\n> ${provenanceLine}\n\n${content}\n`;
}

function indexDocument(title, sections) {
  const lines = [`# ${title}`, ""];
  for (const section of sections) {
    lines.push(`# ${section.title}`, "");
    for (const entry of section.entries) {
      lines.push(`* [${markdownText(entry.title)}](${entry.href}) - ${markdownText(entry.description)}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function errorCounts(coverage) {
  const counts = new Map();
  for (const issue of coverage.errors ?? []) counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

async function generateBundle({ config, rawRoot, stagingRoot, manifest, coverage, manifestSha }) {
  const repoRecords = recordByKind(manifest, "repo");
  const legacyRecords = recordByKind(manifest, "doc-legacy").filter((record) => record.valid_payload !== false);
  const ymdRecords = new Map(recordByKind(manifest, "doc-ymd").map((record) => [String(record.source_id), record]));
  const noteRecords = recordByKind(manifest, "note");

  if (config.include?.yuque_documents && legacyRecords.length === 0) throw new Error("no-full-documents");
  if (config.include?.yuque_notes && noteRecords.length === 0) throw new Error("no-full-notes");

  const repos = new Map();
  const latestTimestamps = [];
  for (const record of repoRecords) {
    const payload = await readRawObject(rawRoot, record);
    const id = numericId(payload.id ?? record.source_id, "repository-id");
    const timestamp = isoTimestamp(payload.content_updated_at, payload.updated_at, record.source_updated_at);
    latestTimestamps.push(timestamp);
    repos.set(id, { record, payload, id, timestamp });
  }

  const repoIndexEntries = [];
  for (const repository of [...repos.values()].sort((left, right) => left.id.localeCompare(right.id, "en", { numeric: true }))) {
    const { id, payload, record, timestamp } = repository;
    const title = inlineText(payload.name, `语雀知识库 ${id}`);
    const description = inlineText(payload.description, `语雀知识库 ${id} 的来源信息。`);
    const resource = typeof payload.namespace === "string" && payload.namespace
      ? `https://www.yuque.com/${payload.namespace.replace(/^\/+|\/+$/gu, "")}`
      : undefined;
    const body = [
      description,
      "",
      `- 源端文档声明数：${Number.isFinite(payload.items_count) ? payload.items_count : "未知"}`,
      `- 原始公开标记：${payload.public === 1 ? "公开" : "非公开"}`,
    ].join("\n");
    await writeUtf8(stagingRoot, `yuque/repositories/${id}.md`, concept({
      type: "Yuque Repository",
      title,
      description,
      resource: isUri(resource) ? resource : undefined,
      tags: ["yuque", "repository", "source"],
      timestamp,
      source_system: "yuque",
      source_kind: "repository",
      source_id: id,
      source_object: record.path,
      source_sha256: record.sha256,
      raw_manifest_sha256: manifestSha,
      visibility: "private",
      review_status: "unreviewed",
    }, title, body, "由语雀 Raw 对象生成；Raw 保持不变。"));
    repoIndexEntries.push({ title, href: `${id}.md`, description });
  }

  const documentsByRepo = new Map();
  let ymdCount = 0;
  let legacyFallbackCount = 0;
  if (config.include?.yuque_documents) {
    for (const legacyRecord of legacyRecords) {
      const legacy = await readRawObject(rawRoot, legacyRecord);
      const id = numericId(legacy.id ?? legacyRecord.source_id, "document-id");
      const repoId = numericId(legacyRecord.repo_id ?? legacy.book_id, "document-repository-id");
      const ymdRecord = ymdRecords.get(id);
      const ymd = ymdRecord ? await readRawObject(rawRoot, ymdRecord) : null;
      const sourceRecord = ymdRecord ?? legacyRecord;
      const sourceFormat = ymd && typeof ymd.yfm === "string" && ymd.yfm.trim() ? "ymd" : "legacy-markdown";
      const body = sourceFormat === "ymd"
        ? ymd.yfm
        : (legacy.body || legacy.body_lake || legacy.body_html || legacy.body_draft);
      if (sourceFormat === "ymd") ymdCount += 1;
      else legacyFallbackCount += 1;
      const title = inlineText(ymd?.title ?? legacy.title, `语雀文档 ${id}`);
      const description = inlineText(legacy.description, `语雀文档 ${id} 的完整正文。`);
      const timestamp = isoTimestamp(ymd?.updated_at, legacy.content_updated_at, legacy.updated_at, sourceRecord.source_updated_at);
      latestTimestamps.push(timestamp);
      const resource = isUri(ymd?.url) ? ymd.url : undefined;
      await writeUtf8(stagingRoot, `yuque/documents/${repoId}/${id}.md`, concept({
        type: "Yuque Document",
        title,
        description,
        resource,
        tags: ["yuque", "document", sourceFormat],
        timestamp,
        source_system: "yuque",
        source_kind: "document",
        source_id: id,
        source_repository_id: repoId,
        source_object: sourceRecord.path,
        source_sha256: sourceRecord.sha256,
        source_format: sourceFormat,
        raw_manifest_sha256: manifestSha,
        visibility: "private",
        review_status: "unreviewed",
      }, title, body, `正文格式：${sourceFormat}；由语雀 Raw 对象生成。`));
      if (!documentsByRepo.has(repoId)) documentsByRepo.set(repoId, []);
      documentsByRepo.get(repoId).push({ title, href: `${id}.md`, description });
    }
  }

  const repoDirectoryEntries = [];
  for (const [repoId, entries] of [...documentsByRepo.entries()].sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }))) {
    entries.sort((left, right) => left.href.localeCompare(right.href, "en", { numeric: true }));
    const repoTitle = inlineText(repos.get(repoId)?.payload?.name, `语雀知识库 ${repoId}`);
    await writeUtf8(stagingRoot, `yuque/documents/${repoId}/index.md`, indexDocument(`${repoTitle}文档`, [{
      title: "Documents",
      entries,
    }]));
    repoDirectoryEntries.push({
      title: repoTitle,
      href: `${repoId}/`,
      description: `${entries.length} 份完整文档正文。`,
    });
  }

  const noteIndexEntries = [];
  if (config.include?.yuque_notes) {
    for (const record of noteRecords) {
      const payload = await readRawObject(rawRoot, record);
      const id = numericId(payload.id ?? record.source_id, "note-id");
      const body = payload.content?.source || payload.content?.html;
      const title = inlineText(payload.content?.abstract, `语雀小记 ${id}`, 100);
      const description = inlineText(payload.content?.abstract, `语雀小记 ${id} 的完整正文。`);
      const timestamp = isoTimestamp(payload.content?.updated_at, payload.updated_at, payload.created_at, record.source_updated_at);
      latestTimestamps.push(timestamp);
      await writeUtf8(stagingRoot, `yuque/notes/${id}.md`, concept({
        type: "Yuque Note",
        title,
        description,
        tags: ["yuque", "note", payload.status === 9 ? "deleted-at-source" : "active-at-source"],
        timestamp,
        source_system: "yuque",
        source_kind: "note",
        source_id: id,
        source_object: record.path,
        source_sha256: record.sha256,
        source_format: payload.content?.format || "markdown",
        source_status: Number.isFinite(payload.status) ? payload.status : undefined,
        raw_manifest_sha256: manifestSha,
        visibility: "private",
        review_status: "unreviewed",
      }, title, body, "由语雀 Raw 小记对象生成；删除状态也按源数据保留。"));
      noteIndexEntries.push({ title, href: `${id}.md`, description });
    }
  }
  noteIndexEntries.sort((left, right) => left.href.localeCompare(right.href, "en", { numeric: true }));

  await writeUtf8(stagingRoot, "yuque/repositories/index.md", indexDocument("语雀知识库", [{
    title: "Repositories",
    entries: repoIndexEntries,
  }]));
  await writeUtf8(stagingRoot, "yuque/documents/index.md", indexDocument("语雀文档", [{
    title: "Repositories",
    entries: repoDirectoryEntries,
  }]));
  await writeUtf8(stagingRoot, "yuque/notes/index.md", indexDocument("语雀小记", [{
    title: "Notes",
    entries: noteIndexEntries,
  }]));
  await writeUtf8(stagingRoot, "yuque/index.md", indexDocument("语雀个人知识", [{
    title: "Collections",
    entries: [
      { title: "知识库", href: "repositories/", description: `${repoRecords.length} 个个人知识库。` },
      { title: "文档", href: "documents/", description: `${legacyRecords.length} 份完整文档正文。` },
      { title: "小记", href: "notes/", description: `${noteRecords.length} 条完整小记正文。` },
    ],
  }]));

  const snapshotDate = latestTimestamps
    .filter((value) => value !== "1970-01-01T00:00:00.000Z")
    .sort()
    .at(-1)?.slice(0, 10) ?? "1970-01-01";
  const failures = errorCounts(coverage);
  const failureSummary = failures.length > 0
    ? failures.map(([code, count]) => `${code}=${count}`).join(", ")
    : "none";
  const snapshot = [
    `- Raw manifest SHA-256：\`${manifestSha}\``,
    `- Coverage complete：\`${Boolean(coverage.complete)}\``,
    `- Coverage errors / warnings：${coverage.counts?.errors ?? coverage.errors?.length ?? 0} / ${coverage.counts?.warnings ?? coverage.warnings?.length ?? 0}`,
    `- 未完成项：${failureSummary}`,
    `- 文档正文格式：YMD ${ymdCount}；legacy fallback ${legacyFallbackCount}`,
    `- 资源引用：成功 ${coverage.counts?.assets_saved ?? 0} / 发现 ${coverage.counts?.assets_discovered ?? 0}`,
  ].join("\n");
  // The project-level knowledge/index.md declares okf_version. This generated
  // subtree omits root frontmatter so it is also valid when traversed as part
  // of that containing Bundle; OKF version declarations are root-only.
  const rootIndex = `# 陈远个人知识 Bundle\n\n这是从私有 Raw 数据确定性生成的 OKF v0.1 Knowledge Bundle。它不是网站公开内容。\n\n## Snapshot\n\n${snapshot}\n\n# Collections\n\n* [语雀个人知识](yuque/) - 个人知识库、完整文档和小记正文。\n`;
  await writeUtf8(stagingRoot, "index.md", rootIndex);

  const log = `# Knowledge Bundle Update Log\n\n## ${snapshotDate}\n\n* **Snapshot**: Generated the Yuque OKF bundle from Raw manifest \`${manifestSha}\`.\n* **Coverage**: Recorded complete=${Boolean(coverage.complete)}, errors=${coverage.counts?.errors ?? coverage.errors?.length ?? 0}, warnings=${coverage.counts?.warnings ?? coverage.warnings?.length ?? 0}.\n* **Fallback**: Used ${legacyFallbackCount} legacy full-document bodies where YMD was unavailable.\n`;
  await writeUtf8(stagingRoot, "log.md", log);
  await writeUtf8(stagingRoot, "yuque/log.md", log.replace("# Knowledge Bundle", "# Yuque Bundle"));

  return {
    repositories: repoRecords.length,
    documents: legacyRecords.length,
    notes: noteRecords.length,
    ymd_documents: ymdCount,
    legacy_fallback_documents: legacyFallbackCount,
    concepts: repoRecords.length + legacyRecords.length + noteRecords.length,
  };
}

async function main() {
  if (process.argv.slice(2).length > 0) throw new Error("unexpected-arguments");
  const configPath = resolveInside(PROJECT_ROOT, "config/okf.json", "config");
  await assertRegularFile(configPath, PROJECT_ROOT);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (config.okf_version !== "0.1") throw new Error("unsupported-okf-version");

  const rawRoot = resolveInside(PROJECT_ROOT, config.input?.yuque_raw_root, "raw-root");
  const outputRoot = resolveInside(PROJECT_ROOT, config.output?.bundle_root, "output-root");
  const outputRelative = path.relative(PROJECT_ROOT, outputRoot);
  if (!outputRelative.startsWith(`knowledge${path.sep}private${path.sep}`)) throw new Error("output-must-be-private-knowledge");

  const manifestPath = resolveInside(rawRoot, "manifest.json", "manifest");
  const coveragePath = resolveInside(rawRoot, "coverage.json", "coverage");
  await assertRegularFile(manifestPath, rawRoot);
  await assertRegularFile(coveragePath, rawRoot);
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const coverage = JSON.parse(await readFile(coveragePath, "utf8"));
  if (manifest.schema_version !== "1.0.0" || coverage.schema_version !== "1.0.0") throw new Error("unsupported-raw-schema");
  if (JSON.stringify(manifest.coverage) !== JSON.stringify(coverage)) throw new Error("manifest-coverage-mismatch");

  const manifestSha = sha256(manifestBytes);
  const parent = path.dirname(outputRoot);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const stagingRoot = `${outputRoot}.staging-${randomUUID()}`;
  const backupRoot = `${outputRoot}.backup-${randomUUID()}`;
  await mkdir(stagingRoot, { recursive: false, mode: 0o700 });
  let movedExisting = false;
  try {
    const counts = await generateBundle({ config, rawRoot, stagingRoot, manifest, coverage, manifestSha });
    try {
      const existing = await lstat(outputRoot);
      if (existing.isSymbolicLink() || !existing.isDirectory()) throw new Error("output-not-directory");
      await rename(outputRoot, backupRoot);
      movedExisting = true;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await rename(stagingRoot, outputRoot);
    if (movedExisting) await rm(backupRoot, { recursive: true, force: true });
    process.stdout.write(`${JSON.stringify({ okf_version: "0.1", manifest_sha256: manifestSha, coverage_complete: Boolean(coverage.complete), ...counts })}\n`);
  } catch (error) {
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => {});
    if (movedExisting) await rename(backupRoot, outputRoot).catch(() => {});
    throw error;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  main().catch((error) => {
    const reason = String(error?.message ?? error ?? "unknown").replace(/[\r\n]+/gu, " ").slice(0, 240);
    process.stderr.write(`[yuque-to-okf] fatal=${JSON.stringify(reason)}\n`);
    process.exitCode = 1;
  });
}

export { frontmatter, generateBundle, inlineText, main };
