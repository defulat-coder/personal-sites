#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

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
    try { fields[key] = JSON.parse(rawValue); } catch { fields[key] = rawValue; }
  }
  return { fields, body: normalized.slice(end + 5) };
}

async function main() {
  if (process.argv.slice(2).length > 0) throw new Error("unexpected-arguments");
  const config = JSON.parse(await readFile(resolveInside(PROJECT_ROOT, "config/okf.json", "config"), "utf8"));
  const rawRoot = resolveInside(PROJECT_ROOT, config.input?.github_raw_root, "raw-root");
  const bundleRoot = resolveInside(PROJECT_ROOT, config.output?.bundle_root, "bundle-root");
  const manifestFile = resolveInside(rawRoot, "manifest.json", "raw-manifest");
  const manifestBytes = await readFile(manifestFile);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const reportFile = resolveInside(bundleRoot, "github-curation.json", "curation-report");
  await assertRegularFile(reportFile, bundleRoot, "curation-report");
  const report = JSON.parse(await readFile(reportFile, "utf8"));
  assert(report.schema_version === "1.0.0", "github-curation-schema-unsupported");
  assert(report.okf_version === config.okf_version, "github-curation-okf-version-mismatch");
  assert(report.raw_manifest_sha256 === sha256(manifestBytes), "github-curation-report-stale");
  assert(report.snapshot_timestamp === manifest.snapshot_at, "github-curation-snapshot-mismatch");
  assert(report.policy?.stable_source_paths === true, "github-stable-path-policy-missing");
  assert(report.policy?.repository_identity === "github-numeric-repository-id", "github-identity-policy-invalid");
  assert(report.policy?.collection_deduplication === "one-concept-per-repository-id", "github-deduplication-policy-invalid");
  assert(report.policy?.relationship_history_retained === true, "github-history-policy-missing");
  assert(report.policy?.inactive_sources_retained === true, "github-inactive-retention-policy-missing");
  assert(Array.isArray(report.items), "github-curation-items-missing");
  assert(report.items.length === manifest.counts.repositories, "github-curation-item-count-mismatch");

  const itemById = new Map();
  const indexSources = {
    owned: await readFile(resolveInside(bundleRoot, "github/owned/index.md", "owned-index"), "utf8"),
    starred: await readFile(resolveInside(bundleRoot, "github/starred/index.md", "starred-index"), "utf8"),
    watched: await readFile(resolveInside(bundleRoot, "github/watched/index.md", "watched-index"), "utf8"),
    inactive: await readFile(resolveInside(bundleRoot, "github/inactive/index.md", "inactive-index"), "utf8"),
  };
  for (const item of report.items) {
    assert(/^\d+$/u.test(item.source_id), `github-curation-source-id-invalid:${item.source_id}`);
    assert(item.concept_id === `/github/repositories/${item.source_id}.md`, `github-concept-id-unstable:${item.source_id}`);
    assert(!itemById.has(item.source_id), `github-curation-source-id-duplicate:${item.source_id}`);
    itemById.set(item.source_id, item);
    const conceptFile = resolveInside(bundleRoot, item.concept_id.slice(1), "repository-concept");
    await assertRegularFile(conceptFile, bundleRoot, "repository-concept");
    const source = await readFile(conceptFile, "utf8");
    const parsed = parseFrontmatter(source, item.concept_id);
    assert(parsed.fields.type === "GitHub Repository", `github-concept-type-invalid:${item.source_id}`);
    assert(parsed.fields.source_id === item.source_id, `github-concept-source-id-mismatch:${item.source_id}`);
    assert(parsed.fields.raw_manifest_sha256 === report.raw_manifest_sha256, `github-concept-manifest-sha-mismatch:${item.source_id}`);
    assert(JSON.stringify(parsed.fields.github_relationships) === JSON.stringify(item.relationships), `github-concept-relationships-mismatch:${item.source_id}`);
    assert(parsed.fields.repository_active === item.active, `github-concept-active-mismatch:${item.source_id}`);
    assert(parsed.fields.project_role === item.project_role, `github-concept-role-mismatch:${item.source_id}`);
    if (item.readme_status === "available") {
      assert(typeof parsed.fields.readme_sha256 === "string", `github-concept-readme-sha-missing:${item.source_id}`);
      assert(parsed.fields.readme_source_object === item.readme_source_object, `github-concept-readme-path-mismatch:${item.source_id}`);
    }
    for (const relationship of item.relationships) {
      assert(indexSources[relationship].includes(`(${item.concept_id})`), `github-${relationship}-index-link-missing:${item.source_id}`);
    }
    if (!item.active) assert(indexSources.inactive.includes(`(${item.concept_id})`), `github-inactive-index-link-missing:${item.source_id}`);
  }
  for (const object of manifest.objects) {
    const item = itemById.get(object.source_id);
    assert(item, `github-curation-object-missing:${object.source_id}`);
    assert(JSON.stringify(item.relationships) === JSON.stringify(object.relationships), `github-curation-object-relationships-mismatch:${object.source_id}`);
    assert(item.active === object.active, `github-curation-object-active-mismatch:${object.source_id}`);
  }

  const relationshipCount = (relationship) => report.items.filter((item) => item.active && item.relationships.includes(relationship)).length;
  assert(relationshipCount("owned") === report.counts.owned, "github-report-owned-count-mismatch");
  assert(relationshipCount("starred") === report.counts.starred, "github-report-starred-count-mismatch");
  assert(relationshipCount("watched") === report.counts.watched, "github-report-watched-count-mismatch");
  assert(report.items.filter((item) => !item.active).length === report.counts.inactive, "github-report-inactive-count-mismatch");
  assert(report.items.filter((item) => item.readme_status === "available" && item.active).length === report.counts.readmes, "github-report-readme-count-mismatch");
  for (const field of ["repositories", "active", "inactive", "owned", "owned_originals", "owned_forks", "starred", "watched", "private", "archived", "readmes"]) {
    assert(report.counts[field] === manifest.counts[field], `github-report-${field}-raw-count-mismatch`);
  }

  process.stdout.write(`${JSON.stringify({
    verified: true,
    repositories: report.items.length,
    owned: report.counts.owned,
    starred: report.counts.starred,
    watched: report.counts.watched,
    inactive: report.counts.inactive,
    readmes: report.counts.readmes,
  })}\n`);
}

main().catch((error) => {
  const reason = String(error?.message ?? error ?? "unknown").replace(/[\r\n]+/gu, " ").slice(0, 240);
  process.stderr.write(`[verify-github-okf] fatal=${JSON.stringify(reason)}\n`);
  process.exitCode = 1;
});
