#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { resolveInside, sha256 } from "./lib/private-file-integrity.mjs";
import { historyObjectKey } from "./lib/agent-history.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

async function assertRegularFile(file, root, code) {
  resolveInside(root, path.relative(root, file), code);
  const details = await lstat(file);
  assert(details.isFile() && !details.isSymbolicLink(), `${code}-not-regular-file`);
  return details;
}

async function hashFile(file) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest("hex");
}

function expectedCounts(records) {
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
  const args = process.argv.slice(2);
  if (args.some((value) => value !== "--full") || args.length > 1) throw new Error("unexpected-arguments");
  const full = args.includes("--full");
  const config = JSON.parse(await readFile(resolveInside(PROJECT_ROOT, "config/agent-history-sync.json", "config"), "utf8"));
  const rawRoot = resolveInside(PROJECT_ROOT, config.storage?.raw_root, "raw-root");
  const manifestFile = resolveInside(rawRoot, "manifest.json", "manifest");
  const stateFile = resolveInside(rawRoot, "state.json", "state");
  await assertRegularFile(manifestFile, rawRoot, "manifest");
  await assertRegularFile(stateFile, rawRoot, "state");
  const manifestBytes = await readFile(manifestFile);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const state = JSON.parse(await readFile(stateFile, "utf8"));
  assert(manifest.schema_version === "1.0.0", "manifest-schema-unsupported");
  assert(manifest.source_system === "agent-history", "manifest-source-system-invalid");
  assert(manifest.complete === true, "manifest-incomplete");
  assert(Array.isArray(manifest.objects), "manifest-objects-missing");
  assert(Array.isArray(manifest.changes), "manifest-changes-missing");
  assert(Array.isArray(manifest.warnings), "manifest-warnings-missing");
  assert(Array.isArray(manifest.errors) && manifest.errors.length === 0, "manifest-has-errors");
  assert(manifest.projection_policy?.raw_files_complete === true, "raw-completeness-policy-missing");
  assert(JSON.stringify(manifest.projection_policy?.readable_roles) === JSON.stringify(["user", "assistant"]), "projection-role-policy-invalid");
  assert(manifest.projection_policy?.revision === 3, "projection-revision-invalid");
  assert(state.manifest_sha256 === sha256(manifestBytes), "state-manifest-hash-mismatch");
  assert(manifest.coverage?.codex_memory_database?.required === true, "codex-memory-database-coverage-missing");
  assert(manifest.coverage?.codex_memory_database?.status === "complete", "codex-memory-database-coverage-incomplete");

  const keys = new Set();
  const rawReferences = new Map();
  let projectionBytes = 0;
  let fullHashed = 0;
  for (const object of manifest.objects) {
    assert(["codex", "claude-code"].includes(object.platform), `object-platform-invalid:${object.sourceId}`);
    assert(["conversation", "memory", "index", "prompt-history"].includes(object.kind), `object-kind-invalid:${object.sourceId}`);
    const key = historyObjectKey(object);
    assert(!keys.has(key), `object-identity-duplicate:${key}`);
    keys.add(key);
    assert(typeof object.sourcePath === "string" && object.sourcePath.length > 0 && !path.isAbsolute(object.sourcePath), `object-source-path-invalid:${key}`);
    assert(typeof object.active === "boolean", `object-active-invalid:${key}`);
    assert(/^[a-f0-9]{64}$/u.test(object.raw?.sha256 ?? ""), `raw-sha-invalid:${key}`);
    assert(object.raw.path === `blobs/${object.raw.sha256.slice(0, 2)}/${object.raw.sha256}.blob`, `raw-content-address-invalid:${key}`);
    const rawFile = resolveInside(rawRoot, object.raw.path, "raw-blob");
    const rawDetails = await assertRegularFile(rawFile, rawRoot, "raw-blob");
    assert(rawDetails.size === object.raw.size, `raw-size-mismatch:${key}`);
    if (rawReferences.has(object.raw.path)) {
      assert(rawReferences.get(object.raw.path) === object.raw.sha256, `raw-reference-collision:${key}`);
    } else rawReferences.set(object.raw.path, object.raw.sha256);
    if (full) {
      assert(await hashFile(rawFile) === object.raw.sha256, `raw-sha-mismatch:${key}`);
      fullHashed += 1;
      if (fullHashed % 100 === 0) process.stderr.write(`[verify-agent-history] raw_progress=${fullHashed}/${manifest.objects.length}\n`);
    }

    const needsProjection = object.kind === "conversation" || object.kind === "prompt-history";
    assert(Boolean(object.projection) === needsProjection, `projection-presence-invalid:${key}`);
    if (object.projection) {
      assert(object.metadata?.projectionRevision === manifest.projection_policy.revision, `projection-revision-mismatch:${key}`);
      assert(/^[a-f0-9]{64}$/u.test(object.projection.sha256 ?? ""), `projection-sha-invalid:${key}`);
      const projectionFile = resolveInside(rawRoot, object.projection.path, "projection");
      const details = await assertRegularFile(projectionFile, rawRoot, "projection");
      const bytes = await readFile(projectionFile);
      projectionBytes += bytes.length;
      assert(details.size === object.projection.size && bytes.length === object.projection.size, `projection-size-mismatch:${key}`);
      assert(sha256(bytes) === object.projection.sha256, `projection-sha-mismatch:${key}`);
      const projection = JSON.parse(bytes.toString("utf8"));
      assert(projection.schema_version === "1.0.0", `projection-schema-invalid:${key}`);
      assert(projection.platform === object.platform && projection.sourceId === object.sourceId, `projection-identity-mismatch:${key}`);
      assert(Array.isArray(projection.messages), `projection-messages-missing:${key}`);
      assert(projection.messages.every((message) => message.role === "user" || message.role === "assistant"), `projection-role-invalid:${key}`);
      assert(projection.messages.length === (object.metadata?.messageCounts?.messages ?? 0), `projection-message-count-mismatch:${key}`);
    }
  }

  const counts = expectedCounts(manifest.objects);
  assert(JSON.stringify(counts) === JSON.stringify(manifest.counts), "manifest-counts-mismatch");
  assert(counts.codex_memory_database_snapshots === 1, "codex-memory-database-snapshot-count-invalid");
  assert(counts.codex_memory_database_rows === manifest.coverage.codex_memory_database.stage1_outputs, "codex-memory-database-row-coverage-mismatch");
  process.stdout.write(`${JSON.stringify({
    verified: true,
    full_raw_hash: full,
    objects: counts.objects,
    conversations: counts.conversations,
    memories: counts.memories,
    codex_memory_database_rows: counts.codex_memory_database_rows,
    codex_conversations: counts.codex_conversations,
    claude_code_conversations: counts.claude_code_conversations,
    messages: counts.messages,
    raw_bytes: counts.raw_bytes,
    projection_bytes: projectionBytes,
    warnings: manifest.warnings.length,
  })}\n`);
}

main().catch((error) => {
  const reason = String(error?.message ?? error ?? "unknown").replace(/[\r\n]+/gu, " ").slice(0, 240);
  process.stderr.write(`[verify-agent-history] fatal=${JSON.stringify(reason)}\n`);
  process.exitCode = 1;
});
