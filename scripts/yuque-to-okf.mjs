#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  buildExactDuplicatePlan,
  buildTitleCollisionGroups,
  classifyContent,
  deriveConceptTitle,
  findNearDuplicatePairs,
  hasEmbeddedResource,
  normalizeExactContent,
  removeRedundantLeadingHeading,
} from "./lib/okf-curation.mjs";

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
    if (section.entries.length === 0) continue;
    lines.push(`# ${section.title}`, "");
    for (const entry of section.entries) {
      lines.push(`* [${markdownText(entry.title)}](${entry.href}) - ${markdownText(entry.description)}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function uniqueTags(...groups) {
  const tags = [];
  const seen = new Set();
  for (const group of groups) {
    const values = Array.isArray(group) ? group : (group ? [group] : []);
    for (const value of values) {
      const candidate = typeof value === "string"
        ? value
        : (value?.name ?? value?.title ?? value?.slug);
      const tag = inlineText(candidate, "", 60);
      if (!tag || seen.has(tag)) continue;
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

function conceptPath(conceptId) {
  return conceptId.replace(/^\//u, "");
}

function curationStatus(item, duplicateAssignment) {
  if (duplicateAssignment?.status === "duplicate") return "duplicate";
  if (item.quality === "archived") return "archived";
  if (item.quality === "empty" || item.quality === "textless") return "needs-review";
  if (item.quality === "media-only") return "media-only";
  if (item.quality === "short-form") return "short-form";
  return "canonical";
}

function appendSection(body, title, lines) {
  if (lines.length === 0) return body;
  return `${body.trimEnd()}\n\n# ${title}\n\n${lines.join("\n")}\n`;
}

function reviewStatus(item, status, nearMatches, titleCollision) {
  if (status === "duplicate") return "duplicate";
  if (status === "archived") return "archived";
  if (status === "needs-review" || item.titleDerived || nearMatches.length > 0 || titleCollision) return "needs-review";
  return "unreviewed";
}

function entrySections(entries, kind) {
  const active = entries.filter((entry) => entry.status === "canonical" && entry.quality === "substantive");
  const shortForm = entries.filter((entry) => entry.status === "short-form");
  const media = entries.filter((entry) => entry.status === "media-only");
  const review = entries.filter((entry) => entry.needsReview);
  const duplicates = entries.filter((entry) => entry.status === "duplicate");
  const archived = entries.filter((entry) => entry.status === "archived");
  return [
    { title: kind === "note" ? "Substantive Notes" : "Canonical Documents", entries: active },
    { title: "Short-form Notes", entries: shortForm },
    { title: "Media-only Knowledge", entries: media },
    { title: "Needs Review", entries: review },
    { title: "Exact Duplicates", entries: duplicates },
    { title: "Archived at Source", entries: archived },
  ];
}

function positiveInteger(value, fallback, label) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${label}-must-be-positive-integer`);
  return number;
}

function normalizeCurationConfig(config) {
  const source = config.curation ?? {};
  const exact = source.exact_duplicates ?? {};
  const near = source.near_duplicates ?? {};
  const threshold = Number(near.threshold ?? 0.9);
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
    throw new Error("near-duplicate-threshold-must-be-between-zero-and-one");
  }
  return {
    shortFormChars: positiveInteger(source.short_form_chars, 100, "short-form-chars"),
    placeholderTitles: Array.isArray(source.placeholder_titles)
      ? source.placeholder_titles.map((value) => String(value))
      : ["", "无标题", "未命名", "新建文档", "untitled"],
    exactDuplicates: {
      minChars: positiveInteger(exact.min_chars, 20, "exact-duplicate-min-chars"),
    },
    nearDuplicates: {
      minChars: positiveInteger(near.min_chars, 100, "near-duplicate-min-chars"),
      threshold,
      shingleSize: positiveInteger(near.shingle_size, 5, "near-duplicate-shingle-size"),
      fingerprintSize: positiveInteger(near.fingerprint_size, 64, "near-duplicate-fingerprint-size"),
      minimumSharedFingerprints: positiveInteger(
        near.minimum_shared_fingerprints,
        3,
        "near-duplicate-minimum-shared-fingerprints",
      ),
      maxBucketSize: positiveInteger(near.max_bucket_size, 40, "near-duplicate-max-bucket-size"),
    },
  };
}

function resourceForDocument(ymd, legacy) {
  if (isUri(ymd?.url)) return ymd.url;
  const namespace = String(legacy.book?.namespace ?? "").replace(/^\/+|\/+$/gu, "");
  const slug = String(legacy.slug ?? "").replace(/^\/+|\/+$/gu, "");
  if (namespace && slug) return `https://www.yuque.com/${namespace}/${slug}`;
  if (typeof ymd?.url === "string" && ymd.url.startsWith("/")) {
    return `https://www.yuque.com${ymd.url}`;
  }
  return undefined;
}

function countBy(items, selector) {
  const counts = {};
  for (const item of items) {
    const key = selector(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function absoluteConceptLink(item) {
  return `/${conceptPath(item.conceptId)}`;
}

function duplicateBody(item, canonical) {
  return [
    `此条目与 [${markdownText(canonical.title)}](${absoluteConceptLink(canonical)}) 的正文完全一致。`,
    "",
    "为避免在 Knowledge Bundle 中重复保存同一份知识，完整正文只保留在主概念中；当前来源路径和 Raw 对象仍然保留。",
  ].join("\n");
}

function reviewEntry(item, reason) {
  return {
    title: item.title,
    href: absoluteConceptLink(item),
    description: `${reason}；${item.kind === "document" ? "文档" : "小记"} ${item.id}。`,
  };
}

function errorCounts(coverage) {
  const counts = new Map();
  for (const issue of coverage.errors ?? []) counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function prepareKnowledgeItem({
  curation,
  type,
  kind,
  id,
  repoId = null,
  sourceTitle,
  fallbackTitle,
  description,
  rawBody,
  sourceStatus,
  sourceFormat,
  sourceRecord,
  legacyRecord = null,
  sourceTags,
  sourcePayload,
  resource,
  createdAt,
  timestamp,
  provenance,
}) {
  const titleResult = deriveConceptTitle({
    sourceTitle: inlineText(sourceTitle, "", 100),
    body: rawBody,
    fallback: fallbackTitle,
    placeholderTitles: curation.placeholderTitles,
  });
  const body = removeRedundantLeadingHeading(rawBody, titleResult.title);
  const classified = classifyContent({
    kind,
    body,
    hasMedia: hasEmbeddedResource(body, sourcePayload),
    sourceStatus,
    shortFormChars: curation.shortFormChars,
  });
  const directory = kind === "document" ? `yuque/documents/${repoId}` : "yuque/notes";
  return {
    conceptId: `/${directory}/${id}.md`,
    outputPath: `${directory}/${id}.md`,
    type,
    kind,
    id,
    repoId,
    title: titleResult.title,
    titleDerived: titleResult.derived,
    description,
    body: classified.cleanedBody,
    normalizedText: classified.normalizedText,
    normalizedLength: classified.normalizedLength,
    fingerprint: classified.normalizedText ? sha256(normalizeExactContent(classified.cleanedBody)) : null,
    quality: classified.quality,
    sourceStatus,
    sourceFormat,
    sourceRecord,
    legacyRecord,
    sourceTags,
    resource,
    createdAt,
    timestamp,
    provenance,
  };
}

async function generateBundle({
  config,
  rawRoot,
  stagingRoot,
  manifest,
  coverage,
  manifestSha,
  includeRootDocuments = true,
}) {
  const curation = normalizeCurationConfig(config);
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

  const items = [];
  let ymdCount = 0;
  let legacyFallbackCount = 0;
  if (config.include?.yuque_documents) {
    for (const legacyRecord of legacyRecords) {
      const legacy = await readRawObject(rawRoot, legacyRecord);
      const id = numericId(legacy.id ?? legacyRecord.source_id, "document-id");
      const repoId = numericId(legacyRecord.repo_id ?? legacy.book_id ?? legacy.book?.id, "document-repository-id");
      const ymdRecord = ymdRecords.get(id);
      const ymd = ymdRecord ? await readRawObject(rawRoot, ymdRecord) : null;
      const sourceRecord = ymdRecord ?? legacyRecord;
      const sourceFormat = ymd && typeof ymd.yfm === "string" && ymd.yfm.trim() ? "ymd" : "legacy-markdown";
      const rawBody = sourceFormat === "ymd"
        ? ymd.yfm
        : (legacy.body || legacy.body_lake || legacy.body_html || legacy.body_draft || "");
      if (sourceFormat === "ymd") ymdCount += 1;
      else legacyFallbackCount += 1;
      const sourceStatus = Number.isFinite(legacy.status) ? legacy.status : undefined;
      const timestamp = isoTimestamp(ymd?.updated_at, legacy.content_updated_at, legacy.updated_at, sourceRecord.source_updated_at);
      latestTimestamps.push(timestamp);
      items.push(prepareKnowledgeItem({
        curation,
        type: "Yuque Document",
        kind: "document",
        id,
        repoId,
        sourceTitle: ymd?.title ?? legacy.title,
        fallbackTitle: `语雀文档 ${id}`,
        description: inlineText(legacy.description, `语雀文档 ${id} 的完整正文。`),
        rawBody,
        sourceStatus,
        sourceFormat,
        sourceRecord,
        legacyRecord,
        sourceTags: legacy.tags,
        sourcePayload: legacy,
        resource: resourceForDocument(ymd, legacy),
        createdAt: isoTimestamp(legacy.created_at, ymd?.created_at),
        timestamp,
        provenance: `正文格式：${sourceFormat}；由语雀 Raw 对象生成。`,
      }));
    }
  }

  if (config.include?.yuque_notes) {
    for (const record of noteRecords) {
      const payload = await readRawObject(rawRoot, record);
      const id = numericId(payload.id ?? record.source_id, "note-id");
      const rawBody = payload.content?.source || payload.content?.html || "";
      const sourceStatus = Number.isFinite(payload.status) ? payload.status : undefined;
      const timestamp = isoTimestamp(payload.content?.updated_at, payload.updated_at, payload.created_at, record.source_updated_at);
      latestTimestamps.push(timestamp);
      items.push(prepareKnowledgeItem({
        curation,
        type: "Yuque Note",
        kind: "note",
        id,
        sourceTitle: payload.content?.abstract,
        fallbackTitle: `语雀小记 ${id}`,
        description: inlineText(payload.content?.abstract, `语雀小记 ${id} 的完整正文。`),
        rawBody,
        sourceStatus,
        sourceFormat: payload.content?.format || "markdown",
        sourceRecord: record,
        sourceTags: payload.tags,
        sourcePayload: payload,
        createdAt: isoTimestamp(payload.created_at, payload.content?.created_at),
        timestamp,
        provenance: "由语雀 Raw 小记对象生成；删除状态也按源数据保留。",
      }));
    }
  }

  items.sort((left, right) => left.conceptId.localeCompare(right.conceptId, "en", { numeric: true }));
  const exactPlan = buildExactDuplicatePlan(items, curation.exactDuplicates);
  const titleCollisionGroups = buildTitleCollisionGroups(items).map((group) => ({
    id: `title-${sha256(group.normalizedTitle).slice(0, 16)}`,
    ...group,
  }));
  const titleCollisionById = new Map();
  for (const group of titleCollisionGroups) {
    for (const conceptId of group.memberIds) titleCollisionById.set(conceptId, group);
  }
  const nearCandidates = items.filter((item) => {
    const assignment = exactPlan.assignments.get(item.conceptId);
    return assignment?.status !== "duplicate" && item.quality !== "archived";
  });
  const nearPairs = findNearDuplicatePairs(nearCandidates, curation.nearDuplicates);
  const nearById = new Map();
  for (const pair of nearPairs) {
    const [left, right] = pair.conceptIds;
    if (!nearById.has(left)) nearById.set(left, []);
    if (!nearById.has(right)) nearById.set(right, []);
    nearById.get(left).push({ conceptId: right, similarity: pair.similarity });
    nearById.get(right).push({ conceptId: left, similarity: pair.similarity });
  }

  const curatedItems = items.map((item) => {
    const duplicateAssignment = exactPlan.assignments.get(item.conceptId);
    const titleCollision = titleCollisionById.get(item.conceptId) ?? null;
    const nearMatches = (nearById.get(item.conceptId) ?? [])
      .sort((left, right) => right.similarity - left.similarity || left.conceptId.localeCompare(right.conceptId));
    const status = curationStatus(item, duplicateAssignment);
    return {
      ...item,
      duplicateAssignment,
      titleCollision,
      nearMatches,
      status,
      reviewStatus: reviewStatus(item, status, nearMatches, titleCollision),
    };
  });
  const curatedById = new Map(curatedItems.map((item) => [item.conceptId, item]));

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
  const noteIndexEntries = [];
  const reviewIndexEntries = [];
  const duplicateSourceEntries = [];
  const archiveIndexEntries = [];
  for (const item of curatedItems) {
    const assignment = item.duplicateAssignment;
    const canonical = assignment?.duplicateOf ? curatedById.get(assignment.duplicateOf) : null;
    let body = canonical ? duplicateBody(item, canonical) : item.body;
    if (assignment?.duplicates?.length > 0) {
      body = appendSection(body, "Duplicate Sources", assignment.duplicates.map((conceptId) => {
        const duplicate = curatedById.get(conceptId);
        return `* [${markdownText(duplicate.title)}](${absoluteConceptLink(duplicate)}) - 相同正文的语雀来源。`;
      }));
    }
    if (item.titleCollision) {
      body = appendSection(body, "Same-Title Concepts", item.titleCollision.memberIds
        .filter((conceptId) => conceptId !== item.conceptId)
        .map((conceptId) => {
          const related = curatedById.get(conceptId);
          return `* [${markdownText(related.title)}](${absoluteConceptLink(related)}) - 标题相同但正文并不完全一致。`;
        }));
    }
    if (item.nearMatches.length > 0) {
      body = appendSection(body, "Near-Duplicate Review", item.nearMatches.map((match) => {
        const related = curatedById.get(match.conceptId);
        return `* [${markdownText(related.title)}](${absoluteConceptLink(related)}) - 相似度 ${(match.similarity * 100).toFixed(1)}%，等待人工判断。`;
      }));
    }
    const duplicateSources = assignment?.duplicates ?? [];
    await writeUtf8(stagingRoot, item.outputPath, concept({
      type: item.type,
      title: item.title,
      description: item.description,
      resource: isUri(item.resource) ? item.resource : undefined,
      tags: uniqueTags(
        ["yuque", item.kind, item.sourceFormat, `quality:${item.quality}`, `curation:${item.status}`],
        item.sourceTags,
      ),
      timestamp: item.timestamp,
      source_system: "yuque",
      source_kind: item.kind,
      source_id: item.id,
      source_repository_id: item.repoId ?? undefined,
      source_object: item.sourceRecord.path,
      source_sha256: item.sourceRecord.sha256,
      source_legacy_object: item.legacyRecord && item.legacyRecord !== item.sourceRecord ? item.legacyRecord.path : undefined,
      source_legacy_sha256: item.legacyRecord && item.legacyRecord !== item.sourceRecord ? item.legacyRecord.sha256 : undefined,
      source_format: item.sourceFormat,
      source_status: item.sourceStatus,
      raw_manifest_sha256: manifestSha,
      visibility: "private",
      review_status: item.reviewStatus,
      content_quality: item.quality,
      curation_status: item.status,
      content_fingerprint: item.fingerprint ?? undefined,
      normalized_chars: item.normalizedLength,
      title_derived: item.titleDerived,
      duplicate_group: assignment?.duplicateGroup,
      duplicate_of: assignment?.duplicateOf ?? undefined,
      duplicate_sources: duplicateSources.length > 0 ? duplicateSources : undefined,
      title_collision_group: item.titleCollision?.id,
      same_title_concepts: item.titleCollision
        ? item.titleCollision.memberIds.filter((conceptId) => conceptId !== item.conceptId)
        : undefined,
      near_duplicates: item.nearMatches.length > 0
        ? item.nearMatches.map((match) => match.conceptId)
        : undefined,
    }, item.title, body, item.provenance));

    const entry = {
      title: item.title,
      href: `${item.id}.md`,
      description: `${item.description}（${item.quality} / ${item.status}）`,
      status: item.status,
      quality: item.quality,
      nearDuplicate: item.nearMatches.length > 0,
      titleDerived: item.titleDerived,
      needsReview: item.reviewStatus === "needs-review",
    };
    if (item.kind === "document") {
      if (!documentsByRepo.has(item.repoId)) documentsByRepo.set(item.repoId, []);
      documentsByRepo.get(item.repoId).push(entry);
    } else {
      noteIndexEntries.push(entry);
    }

    const reasons = [];
    if (item.status === "needs-review") reasons.push(item.quality === "empty" ? "空正文" : "无有效文本");
    if (item.titleDerived) reasons.push("标题由正文推导");
    if (item.nearMatches.length > 0) reasons.push("存在近似正文");
    if (item.titleCollision) reasons.push("同名异文");
    if (reasons.length > 0) reviewIndexEntries.push(reviewEntry(item, reasons.join("、")));
    if (item.status === "duplicate") duplicateSourceEntries.push(reviewEntry(item, "精确重复来源"));
    if (item.quality === "archived") archiveIndexEntries.push(reviewEntry(item, "源端已删除"));
  }

  const repoDirectoryEntries = [];
  for (const [repoId, entries] of [...documentsByRepo.entries()].sort(([left], [right]) => left.localeCompare(right, "en", { numeric: true }))) {
    entries.sort((left, right) => left.href.localeCompare(right.href, "en", { numeric: true }));
    const repoTitle = inlineText(repos.get(repoId)?.payload?.name, `语雀知识库 ${repoId}`);
    await writeUtf8(
      stagingRoot,
      `yuque/documents/${repoId}/index.md`,
      indexDocument(`${repoTitle}文档`, entrySections(entries, "document")),
    );
    repoDirectoryEntries.push({
      title: repoTitle,
      href: `${repoId}/`,
      description: `${entries.length} 份完整文档正文。`,
    });
  }

  noteIndexEntries.sort((left, right) => left.href.localeCompare(right.href, "en", { numeric: true }));
  reviewIndexEntries.sort((left, right) => left.href.localeCompare(right.href, "en", { numeric: true }));
  duplicateSourceEntries.sort((left, right) => left.href.localeCompare(right.href, "en", { numeric: true }));
  archiveIndexEntries.sort((left, right) => left.href.localeCompare(right.href, "en", { numeric: true }));

  const duplicateGroupEntries = exactPlan.groups.map((group) => {
    const canonical = curatedById.get(group.canonicalId);
    return {
      title: canonical.title,
      href: absoluteConceptLink(canonical),
      description: `${group.memberIds.length - 1} 个重复来源收敛到该主概念；组 ${group.id}。`,
    };
  });
  const titleCollisionEntries = titleCollisionGroups.map((group) => {
    const first = curatedById.get(group.memberIds[0]);
    return {
      title: first.title,
      href: absoluteConceptLink(first),
      description: `${group.memberIds.length} 个同名异文概念互相链接；组 ${group.id}。`,
    };
  });

  await writeUtf8(stagingRoot, "yuque/repositories/index.md", indexDocument("语雀知识库", [{
    title: "Repositories",
    entries: repoIndexEntries,
  }]));
  await writeUtf8(stagingRoot, "yuque/documents/index.md", indexDocument("语雀文档", [{
    title: "Repositories",
    entries: repoDirectoryEntries,
  }]));
  await writeUtf8(stagingRoot, "yuque/notes/index.md", indexDocument("语雀小记", entrySections(noteIndexEntries, "note")));
  await writeUtf8(stagingRoot, "yuque/review/index.md", indexDocument("语雀内容复核队列", [
    { title: "Needs Review", entries: reviewIndexEntries },
    { title: "Same-Title Groups", entries: titleCollisionEntries },
  ]));
  await writeUtf8(stagingRoot, "yuque/duplicates/index.md", indexDocument("语雀精确重复内容", [
    { title: "Canonical Concepts", entries: duplicateGroupEntries },
    { title: "Redundant Sources", entries: duplicateSourceEntries },
  ]));
  await writeUtf8(stagingRoot, "yuque/archive/index.md", indexDocument("语雀源端归档内容", [{
    title: "Archived at Source",
    entries: archiveIndexEntries,
  }]));
  await writeUtf8(stagingRoot, "yuque/index.md", indexDocument("语雀个人知识", [{
    title: "Collections",
    entries: [
      { title: "知识库", href: "repositories/", description: `${repoRecords.length} 个个人知识库。` },
      { title: "文档", href: "documents/", description: `${legacyRecords.length} 份完整文档正文。` },
      { title: "小记", href: "notes/", description: `${noteRecords.length} 条完整小记正文。` },
      { title: "复核队列", href: "review/", description: `${reviewIndexEntries.length} 条需要人工判断的内容。` },
      { title: "精确重复", href: "duplicates/", description: `${duplicateSourceEntries.length} 个冗余来源，正文已收敛。` },
      { title: "源端归档", href: "archive/", description: `${archiveIndexEntries.length} 条源端已删除内容。` },
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
  const qualityCounts = countBy(curatedItems, (item) => item.quality);
  const statusCounts = countBy(curatedItems, (item) => item.status);
  const redundantExactCopies = exactPlan.groups.reduce((total, group) => total + group.memberIds.length - 1, 0);
  const titleCollisionItems = new Set(titleCollisionGroups.flatMap((group) => group.memberIds)).size;
  const curationCounts = {
    repositories: repoRecords.length,
    documents: legacyRecords.length,
    notes: noteRecords.length,
    total_items: curatedItems.length,
    exact_duplicate_groups: exactPlan.groups.length,
    redundant_exact_copies: redundantExactCopies,
    near_duplicate_pairs: nearPairs.length,
    title_collision_groups: titleCollisionGroups.length,
    title_collision_items: titleCollisionItems,
    review_queue_items: reviewIndexEntries.length,
    archived_items: archiveIndexEntries.length,
    content_quality: qualityCounts,
    curation_status: statusCounts,
  };
  const curationReport = {
    schema_version: "1.0.0",
    okf_version: config.okf_version,
    raw_manifest_sha256: manifestSha,
    snapshot_timestamp: snapshotDate === "1970-01-01" ? "1970-01-01T00:00:00.000Z" : `${snapshotDate}T00:00:00.000Z`,
    policy: {
      stable_source_paths: true,
      raw_objects_immutable: true,
      exact_duplicates: {
        action: "canonical-with-reference-stubs",
        min_chars: curation.exactDuplicates.minChars,
      },
      near_duplicates: {
        action: "human-review-only",
        min_chars: curation.nearDuplicates.minChars,
        threshold: curation.nearDuplicates.threshold,
        shingle_size: curation.nearDuplicates.shingleSize,
        fingerprint_size: curation.nearDuplicates.fingerprintSize,
        minimum_shared_fingerprints: curation.nearDuplicates.minimumSharedFingerprints,
        max_bucket_size: curation.nearDuplicates.maxBucketSize,
      },
      same_titles: {
        action: "human-review-only",
        require_distinct_bodies: true,
      },
      short_form_chars: curation.shortFormChars,
    },
    counts: curationCounts,
    raw_coverage: {
      complete: Boolean(coverage.complete),
      errors: coverage.counts?.errors ?? coverage.errors?.length ?? 0,
      warnings: coverage.counts?.warnings ?? coverage.warnings?.length ?? 0,
      error_codes: Object.fromEntries(failures),
    },
    exact_duplicate_groups: exactPlan.groups.map((group) => ({
      id: group.id,
      fingerprint: group.fingerprint,
      canonical_concept_id: group.canonicalId,
      member_concept_ids: group.memberIds,
    })),
    near_duplicate_pairs: nearPairs.map((pair) => ({
      concept_ids: pair.conceptIds,
      similarity: pair.similarity,
      shared_fingerprints: pair.sharedFingerprints,
    })),
    title_collision_groups: titleCollisionGroups.map((group) => ({
      id: group.id,
      normalized_title: group.normalizedTitle,
      member_concept_ids: group.memberIds,
    })),
    items: curatedItems.map((item) => ({
      concept_id: item.conceptId,
      kind: item.kind,
      source_id: item.id,
      source_repository_id: item.repoId,
      title: item.title,
      title_derived: item.titleDerived,
      content_quality: item.quality,
      curation_status: item.status,
      review_status: item.reviewStatus,
      normalized_chars: item.normalizedLength,
      content_fingerprint: item.fingerprint,
      duplicate_group: item.duplicateAssignment?.duplicateGroup ?? null,
      duplicate_of: item.duplicateAssignment?.duplicateOf ?? null,
      title_collision_group: item.titleCollision?.id ?? null,
      same_title_concepts: item.titleCollision
        ? item.titleCollision.memberIds.filter((conceptId) => conceptId !== item.conceptId)
        : [],
      near_duplicates: item.nearMatches,
    })),
  };
  await writeUtf8(stagingRoot, "curation.json", `${JSON.stringify(curationReport, null, 2)}\n`);

  const reportBody = [
    "这份报告描述从不可变 Raw 快照生成当前 OKF Knowledge Bundle 时采用的整理决策。",
    "",
    "## Outcome",
    "",
    `- 知识条目：${curatedItems.length}（文档 ${legacyRecords.length}，小记 ${noteRecords.length}）`,
    `- 精确重复：${exactPlan.groups.length} 组，收敛 ${redundantExactCopies} 个冗余正文`,
    `- 近似重复：${nearPairs.length} 对，只进入人工复核，不自动合并`,
    `- 同名异文：${titleCollisionGroups.length} 组，涉及 ${titleCollisionItems} 条内容`,
    `- 复核队列：${reviewIndexEntries.length} 条`,
    `- 源端归档：${archiveIndexEntries.length} 条`,
    "",
    "## Content Quality",
    "",
    ...Object.entries(qualityCounts).map(([quality, count]) => `- ${quality}: ${count}`),
    "",
    "## Policy",
    "",
    "- 每个语雀来源保留稳定、可追溯的概念路径。",
    "- 精确重复只在主概念保留完整正文，其余来源生成引用桩。",
    "- 近似重复、空正文和推导标题进入复核队列，不做猜测性删除或合并。",
    "- 同标题但正文不同的概念只建立互链并进入复核，不视为重复正文。",
    "- 短小记、纯媒体和源端已删除内容分层保留。",
  ].join("\n");
  await writeUtf8(stagingRoot, "yuque/curation-report.md", concept({
    type: "Curation Report",
    title: "语雀 OKF 整理报告",
    description: "语雀知识在 OKF Bundle 中的去重、质量分层与复核摘要。",
    tags: ["yuque", "okf", "curation", "report"],
    timestamp: `${snapshotDate}T00:00:00.000Z`,
    source_system: "yuque",
    raw_manifest_sha256: manifestSha,
    visibility: "private",
    review_status: "curated",
  }, "语雀 OKF 整理报告", reportBody, "由确定性整理规则生成；明细见 Bundle 根目录 curation.json。"));

  const snapshot = [
    `- Raw manifest SHA-256：\`${manifestSha}\``,
    `- Coverage complete：\`${Boolean(coverage.complete)}\``,
    `- Coverage errors / warnings：${coverage.counts?.errors ?? coverage.errors?.length ?? 0} / ${coverage.counts?.warnings ?? coverage.warnings?.length ?? 0}`,
    `- 未完成项：${failureSummary}`,
    `- 文档正文格式：YMD ${ymdCount}；legacy fallback ${legacyFallbackCount}`,
    `- 资源引用：成功 ${coverage.counts?.assets_saved ?? 0} / 发现 ${coverage.counts?.assets_discovered ?? 0}`,
    `- 精确重复：${exactPlan.groups.length} 组；冗余正文 ${redundantExactCopies}`,
    `- 近似重复：${nearPairs.length} 对；复核队列 ${reviewIndexEntries.length}`,
    `- 同名异文：${titleCollisionGroups.length} 组；涉及 ${titleCollisionItems} 条内容`,
  ].join("\n");
  // The project-level knowledge/index.md declares okf_version. This generated
  // subtree omits root frontmatter so it is also valid when traversed as part
  // of that containing Bundle; OKF version declarations are root-only.
  const rootIndex = `# 陈远个人知识 Bundle\n\n这是从私有 Raw 数据确定性生成的 OKF v0.1 Knowledge Bundle。它不是网站公开内容。\n\n## Snapshot\n\n${snapshot}\n\n# Collections\n\n* [语雀个人知识](yuque/) - 个人知识库、完整文档和小记正文。\n* [语雀 OKF 整理报告](yuque/curation-report.md) - 去重、质量分层和复核摘要。\n`;
  if (includeRootDocuments) await writeUtf8(stagingRoot, "index.md", rootIndex);

  const log = `# Knowledge Bundle Update Log\n\n## ${snapshotDate}\n\n* **Snapshot**: Generated the Yuque OKF bundle from Raw manifest \`${manifestSha}\`.\n* **Coverage**: Recorded complete=${Boolean(coverage.complete)}, errors=${coverage.counts?.errors ?? coverage.errors?.length ?? 0}, warnings=${coverage.counts?.warnings ?? coverage.warnings?.length ?? 0}.\n* **Fallback**: Used ${legacyFallbackCount} legacy full-document bodies where YMD was unavailable.\n* **Curation**: Folded ${redundantExactCopies} redundant bodies across ${exactPlan.groups.length} exact groups; queued ${nearPairs.length} near-duplicate pairs and ${titleCollisionGroups.length} same-title groups for review.\n`;
  if (includeRootDocuments) await writeUtf8(stagingRoot, "log.md", log);
  await writeUtf8(stagingRoot, "yuque/log.md", log.replace("# Knowledge Bundle", "# Yuque Bundle"));

  return {
    repositories: repoRecords.length,
    documents: legacyRecords.length,
    notes: noteRecords.length,
    ymd_documents: ymdCount,
    legacy_fallback_documents: legacyFallbackCount,
    exact_duplicate_groups: exactPlan.groups.length,
    redundant_exact_copies: redundantExactCopies,
    near_duplicate_pairs: nearPairs.length,
    title_collision_groups: titleCollisionGroups.length,
    review_queue_items: reviewIndexEntries.length,
    concepts: repoRecords.length + curatedItems.length + 1,
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
