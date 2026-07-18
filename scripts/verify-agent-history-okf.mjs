#!/usr/bin/env node

import { opendir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { historyConceptId, historyObjectKey } from "./lib/agent-history.mjs";
import { assertRegularFile, resolveInside, sha256 } from "./lib/private-file-integrity.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function parseFrontmatter(source, conceptId) {
  const normalized = source.replaceAll("\r\n", "\n");
  assert(normalized.startsWith("---\n"), `frontmatter-missing:${conceptId}`);
  const end = normalized.indexOf("\n---\n", 4);
  assert(end >= 0, `frontmatter-not-closed:${conceptId}`);
  const fields = {};
  for (const line of normalized.slice(4, end).split("\n")) {
    if (!line.trim()) continue;
    const delimiter = line.indexOf(":");
    assert(delimiter > 0, `frontmatter-invalid:${conceptId}`);
    const key = line.slice(0, delimiter).trim();
    const rawValue = line.slice(delimiter + 1).trim();
    try {
      fields[key] = JSON.parse(rawValue);
    } catch {
      fields[key] = rawValue;
    }
  }
  return fields;
}

async function collectIndexSources(root) {
  const sources = [];
  const pending = [root];
  while (pending.length > 0) {
    const directory = pending.pop();
    const entries = await opendir(directory);
    for await (const entry of entries) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("agent-history-index-symlink-not-allowed");
      if (entry.isDirectory()) pending.push(file);
      if (entry.isFile() && entry.name === "index.md") sources.push(await readFile(file, "utf8"));
    }
  }
  return sources;
}

async function main() {
  if (process.argv.slice(2).length > 0) throw new Error("unexpected-arguments");
  const configFile = resolveInside(PROJECT_ROOT, "config/okf.json", "config");
  const config = JSON.parse(await readFile(configFile, "utf8"));
  const rawRoot = resolveInside(PROJECT_ROOT, config.input?.agent_history_raw_root, "raw-root");
  const bundleRoot = resolveInside(PROJECT_ROOT, config.output?.bundle_root, "bundle-root");
  const manifestFile = resolveInside(rawRoot, "manifest.json", "raw-manifest");
  const manifestBytes = await readFile(manifestFile);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const reportFile = resolveInside(bundleRoot, "agent-history-curation.json", "curation-report");
  await assertRegularFile(reportFile, bundleRoot, "curation-report");
  const report = JSON.parse(await readFile(reportFile, "utf8"));

  assert(manifest.schema_version === "1.0.0" && manifest.source_system === "agent-history", "agent-history-manifest-unsupported");
  assert(manifest.complete === true, "agent-history-manifest-incomplete");
  assert(report.schema_version === "1.0.0", "agent-history-curation-schema-unsupported");
  assert(report.okf_version === config.okf_version, "agent-history-curation-okf-version-mismatch");
  assert(report.raw_manifest_sha256 === sha256(manifestBytes), "agent-history-curation-report-stale");
  assert(report.snapshot_timestamp === manifest.snapshot_at, "agent-history-curation-snapshot-mismatch");
  assert(report.policy?.raw_files_complete === true, "agent-history-raw-complete-policy-missing");
  assert(report.policy?.raw_objects_immutable === true, "agent-history-raw-immutable-policy-missing");
  assert(report.policy?.stable_conversation_identity === "platform-plus-session-id", "agent-history-conversation-identity-policy-invalid");
  assert(report.policy?.stable_memory_identity === "platform-kind-source-path-hash", "agent-history-memory-identity-policy-invalid");
  assert(JSON.stringify(report.policy?.readable_projection_roles) === JSON.stringify(["user", "assistant"]), "agent-history-readable-role-policy-invalid");
  assert(JSON.stringify(report.policy?.excluded_from_readable_projection) === JSON.stringify(manifest.projection_policy?.excluded_from_okf), "agent-history-exclusion-policy-mismatch");
  assert(report.policy?.inactive_sources_retained === true, "agent-history-inactive-policy-missing");
  assert(report.policy?.codex_memory_database_complete === true, "agent-history-codex-memory-database-policy-incomplete");
  assert(report.policy?.public_publish === "explicit-human-approval-only", "agent-history-publish-policy-invalid");
  assert(Array.isArray(report.items), "agent-history-curation-items-missing");

  const conceptObjects = manifest.objects.filter((object) => ["conversation", "memory", "prompt-history"].includes(object.kind));
  assert(report.items.length === conceptObjects.length, "agent-history-curation-item-count-mismatch");
  const objectByKey = new Map(conceptObjects.map((object) => [historyObjectKey(object), object]));
  assert(objectByKey.size === conceptObjects.length, "agent-history-manifest-object-identity-duplicate");
  const indexSources = await collectIndexSources(resolveInside(bundleRoot, "agent-history", "agent-history-root"));
  const seen = new Set();

  for (const item of report.items) {
    const key = historyObjectKey(item);
    assert(!seen.has(key), `agent-history-curation-identity-duplicate:${key}`);
    seen.add(key);
    const object = objectByKey.get(key);
    assert(object, `agent-history-curation-object-unexpected:${key}`);
    assert(item.concept_id === historyConceptId(object), `agent-history-concept-id-unstable:${key}`);
    if (object.kind === "memory") {
      const expectedId = sha256(`${object.platform}\u0000memory\u0000${object.sourcePath}`).slice(0, 32);
      assert(object.sourceId === expectedId, `agent-history-memory-source-id-unstable:${key}`);
    }
    assert(item.source_path === object.sourcePath, `agent-history-source-path-mismatch:${key}`);
    assert(item.source_state === object.sourceState, `agent-history-source-state-mismatch:${key}`);
    assert(item.active === object.active, `agent-history-active-mismatch:${key}`);
    assert(item.raw_object === object.raw.path && item.raw_sha256 === object.raw.sha256, `agent-history-raw-reference-mismatch:${key}`);
    assert(item.projection_object === (object.projection?.path ?? null), `agent-history-projection-path-mismatch:${key}`);
    assert(item.projection_sha256 === (object.projection?.sha256 ?? null), `agent-history-projection-sha-mismatch:${key}`);

    const conceptFile = resolveInside(bundleRoot, item.concept_id.slice(1), "agent-history-concept");
    await assertRegularFile(conceptFile, bundleRoot, "agent-history-concept");
    const fields = parseFrontmatter(await readFile(conceptFile, "utf8"), item.concept_id);
    const expectedType = object.kind === "conversation"
      ? "Agent Conversation"
      : object.kind === "memory" ? "Agent Memory" : "Agent Prompt History";
    assert(fields.type === expectedType, `agent-history-concept-type-invalid:${key}`);
    assert(fields.source_system === object.platform, `agent-history-source-system-mismatch:${key}`);
    assert(fields.source_kind === object.kind, `agent-history-source-kind-mismatch:${key}`);
    assert(fields.source_id === object.sourceId, `agent-history-source-id-mismatch:${key}`);
    assert(fields.source_path === object.sourcePath, `agent-history-concept-source-path-mismatch:${key}`);
    assert(fields.source_object === object.raw.path && fields.source_sha256 === object.raw.sha256, `agent-history-concept-raw-reference-mismatch:${key}`);
    assert(fields.raw_manifest_sha256 === report.raw_manifest_sha256, `agent-history-concept-manifest-sha-mismatch:${key}`);
    assert(fields.visibility === "private", `agent-history-concept-visibility-invalid:${key}`);
    assert(fields.raw_complete === true, `agent-history-concept-raw-complete-missing:${key}`);
    if (object.projection) {
      assert(fields.projection_object === object.projection.path, `agent-history-concept-projection-path-mismatch:${key}`);
      assert(fields.projection_sha256 === object.projection.sha256, `agent-history-concept-projection-sha-mismatch:${key}`);
      assert(fields.message_count === item.messages, `agent-history-concept-message-count-mismatch:${key}`);
    }
    assert(indexSources.some((source) => source.includes(`(${item.concept_id})`)), `agent-history-index-link-missing:${key}`);
  }

  for (const object of conceptObjects) {
    assert(seen.has(historyObjectKey(object)), `agent-history-curation-object-missing:${historyObjectKey(object)}`);
  }
  for (const [field, value] of Object.entries(manifest.counts)) {
    assert(report.counts[field] === value, `agent-history-report-${field}-raw-count-mismatch`);
  }
  assert(report.counts.concepts === conceptObjects.length, "agent-history-report-concept-count-mismatch");
  assert(report.counts.parse_warnings === manifest.warnings.length, "agent-history-report-warning-count-mismatch");

  const curationConcept = resolveInside(bundleRoot, "agent-history/curation-report.md", "agent-history-curation-concept");
  await assertRegularFile(curationConcept, bundleRoot, "agent-history-curation-concept");
  const rootIndex = await readFile(resolveInside(bundleRoot, "index.md", "bundle-index"), "utf8");
  assert(rootIndex.includes("(agent-history/)"), "agent-history-root-index-link-missing");
  const bundle = JSON.parse(await readFile(resolveInside(bundleRoot, "bundle.json", "bundle-manifest"), "utf8"));
  assert(bundle.sources?.agent_history?.manifest_sha256 === report.raw_manifest_sha256, "agent-history-bundle-manifest-sha-mismatch");

  process.stdout.write(`${JSON.stringify({
    verified: true,
    concepts: report.items.length + 1,
    conversations: report.counts.conversations,
    memories: report.counts.memories,
    messages: report.counts.messages,
    projects: report.counts.projects,
    warnings: report.counts.parse_warnings,
  })}\n`);
}

main().catch((error) => {
  const reason = String(error?.message ?? error ?? "unknown").replace(/[\r\n]+/gu, " ").slice(0, 240);
  process.stderr.write(`[verify-agent-history-okf] fatal=${JSON.stringify(reason)}\n`);
  process.exitCode = 1;
});
