#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { assertRegularFile, resolveInside, sha256 } from "./lib/private-file-integrity.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN_PATTERN = /(?:github_pat_|gh[opusr]_)[A-Za-z0-9_]{20,}/u;

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function countRelationship(records, relationship) {
  return records.filter((record) => record.active && record.relationships.includes(relationship)).length;
}

async function main() {
  if (process.argv.slice(2).length > 0) throw new Error("unexpected-arguments");
  const configPath = resolveInside(PROJECT_ROOT, "config/github-sync.json", "config");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const rawRoot = resolveInside(PROJECT_ROOT, config.storage?.raw_root, "raw-root");
  const manifestPath = resolveInside(rawRoot, "manifest.json", "manifest");
  const statePath = resolveInside(rawRoot, "state.json", "state");
  await assertRegularFile(manifestPath, rawRoot, "manifest");
  await assertRegularFile(statePath, rawRoot, "state");
  const manifestBytes = await readFile(manifestPath);
  assert(!TOKEN_PATTERN.test(manifestBytes.toString("utf8")), "token-like-value-in-manifest");
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const state = JSON.parse(await readFile(statePath, "utf8"));
  assert(manifest.schema_version === "1.0.0", "manifest-schema-unsupported");
  assert(manifest.source_system === "github", "manifest-source-system-invalid");
  assert(manifest.api_version === config.api_version, "manifest-api-version-mismatch");
  assert(manifest.account?.login === config.account, "manifest-account-mismatch");
  assert(manifest.complete === true, "manifest-incomplete");
  assert(Array.isArray(manifest.objects), "manifest-objects-missing");
  assert(Array.isArray(manifest.changes), "manifest-changes-missing");
  assert(Array.isArray(manifest.warnings), "manifest-warnings-missing");
  assert(Array.isArray(manifest.errors) && manifest.errors.length === 0, "manifest-has-errors");
  assert(state.manifest_sha256 === sha256(manifestBytes), "state-manifest-hash-mismatch");

  const sourceIds = new Set();
  const objectPaths = new Set();
  const records = [];
  assert(Array.isArray(manifest.raw_responses) && manifest.raw_responses.length >= 4, "manifest-raw-responses-missing");
  for (const response of manifest.raw_responses) {
    assert(["account", "owned", "starred", "watched"].includes(response.kind), `raw-response-kind-invalid:${response.kind}`);
    assert(/^[a-f0-9]{64}$/u.test(response.sha256), `raw-response-sha-invalid:${response.kind}`);
    const responseFile = resolveInside(rawRoot, response.path, "raw-response");
    await assertRegularFile(responseFile, rawRoot, "raw-response");
    const responseBytes = await readFile(responseFile);
    assert(sha256(responseBytes) === response.sha256, `raw-response-sha-mismatch:${response.kind}`);
    assert(!TOKEN_PATTERN.test(responseBytes.toString("utf8")), `token-like-value-in-raw-response:${response.kind}`);
    const responsePayload = JSON.parse(responseBytes.toString("utf8"));
    const responseItems = response.kind === "account" ? [responsePayload] : responsePayload.flat();
    assert(responseItems.length === response.item_count, `raw-response-item-count-mismatch:${response.kind}`);
  }
  for (const object of manifest.objects) {
    assert(object.kind === "repository", `object-kind-invalid:${object.source_id}`);
    assert(/^\d+$/u.test(object.source_id), `object-source-id-invalid:${object.source_id}`);
    assert(!sourceIds.has(object.source_id), `object-source-id-duplicate:${object.source_id}`);
    assert(!objectPaths.has(object.path), `object-path-duplicate:${object.path}`);
    assert(/^[a-f0-9]{64}$/u.test(object.sha256), `object-sha-invalid:${object.source_id}`);
    sourceIds.add(object.source_id);
    objectPaths.add(object.path);
    const file = resolveInside(rawRoot, object.path, "repository-object");
    await assertRegularFile(file, rawRoot, "repository-object");
    const bytes = await readFile(file);
    assert(sha256(bytes) === object.sha256, `object-sha-mismatch:${object.source_id}`);
    assert(!TOKEN_PATTERN.test(bytes.toString("utf8")), `token-like-value-in-object:${object.source_id}`);
    const payload = JSON.parse(bytes.toString("utf8"));
    assert(payload.schema_version === "1.0.0" && payload.kind === "repository", `object-payload-invalid:${object.source_id}`);
    assert(payload.source_id === object.source_id && payload.record?.sourceId === object.source_id, `object-identity-mismatch:${object.source_id}`);
    assert(Array.isArray(payload.record.relationships), `object-relationships-invalid:${object.source_id}`);
    assert(payload.record.relationships.join(",") === object.relationships.join(","), `object-relationships-summary-mismatch:${object.source_id}`);
    assert(payload.record.active === object.active, `object-active-summary-mismatch:${object.source_id}`);
    if (payload.record.readme?.status === "available") {
      const readme = payload.record.readme;
      assert(/^[a-f0-9]{64}$/u.test(readme.sha256), `readme-sha-invalid:${object.source_id}`);
      const readmeFile = resolveInside(rawRoot, readme.path, "readme-blob");
      await assertRegularFile(readmeFile, rawRoot, "readme-blob");
      const readmeBytes = await readFile(readmeFile);
      assert(sha256(readmeBytes) === readme.sha256, `readme-sha-mismatch:${object.source_id}`);
      assert(readmeBytes.length === readme.size, `readme-size-mismatch:${object.source_id}`);
      assert(!TOKEN_PATTERN.test(readmeBytes.toString("utf8")), `token-like-value-in-readme:${object.source_id}`);
    }
    records.push(payload.record);
  }

  const active = records.filter((record) => record.active);
  assert(records.length === manifest.counts.repositories, "repository-count-mismatch");
  assert(active.length === manifest.counts.active, "active-count-mismatch");
  assert(records.length - active.length === manifest.counts.inactive, "inactive-count-mismatch");
  for (const relationship of ["owned", "starred", "watched"]) {
    const count = countRelationship(records, relationship);
    assert(count === manifest.counts[relationship], `${relationship}-count-mismatch`);
    assert(count === manifest.collections[relationship].count, `${relationship}-collection-count-mismatch`);
    assert(manifest.collections[relationship].complete === true, `${relationship}-collection-incomplete`);
  }
  assert(active.filter((record) => record.relationships.includes("owned") && !record.repository.fork).length === manifest.counts.owned_originals, "owned-original-count-mismatch");
  assert(active.filter((record) => record.relationships.includes("owned") && record.repository.fork).length === manifest.counts.owned_forks, "owned-fork-count-mismatch");
  assert(active.filter((record) => record.readme?.status === "available").length === manifest.counts.readmes, "readme-count-mismatch");

  process.stdout.write(`${JSON.stringify({
    verified: true,
    manifest_sha256: state.manifest_sha256,
    repositories: records.length,
    active: active.length,
    inactive: records.length - active.length,
    owned: manifest.counts.owned,
    starred: manifest.counts.starred,
    watched: manifest.counts.watched,
    readmes: manifest.counts.readmes,
    raw_responses: manifest.raw_responses.length,
    warnings: manifest.warnings.length,
  })}\n`);
}

main().catch((error) => {
  const reason = String(error?.message ?? error ?? "unknown").replace(/[\r\n]+/gu, " ").slice(0, 240);
  process.stderr.write(`[verify-github] fatal=${JSON.stringify(reason)}\n`);
  process.exitCode = 1;
});
