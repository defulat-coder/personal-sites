#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function resolveInside(root, child, label) {
  const resolved = path.resolve(root, child);
  const relative = path.relative(root, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`${label}-outside-root`);
  }
  return resolved;
}

function conceptRelative(conceptId) {
  if (typeof conceptId !== "string" || !conceptId.startsWith("/") || !conceptId.endsWith(".md")) {
    throw new Error(`invalid-concept-id:${conceptId}`);
  }
  return conceptId.slice(1);
}

function parseFrontmatter(source, conceptId) {
  const normalized = String(source).replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) throw new Error(`frontmatter-missing:${conceptId}`);
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) throw new Error(`frontmatter-not-closed:${conceptId}`);
  const fields = {};
  for (const line of normalized.slice(4, end).split("\n")) {
    if (!line.trim()) continue;
    const delimiter = line.indexOf(":");
    if (delimiter <= 0) throw new Error(`frontmatter-invalid-line:${conceptId}`);
    const key = line.slice(0, delimiter).trim();
    const rawValue = line.slice(delimiter + 1).trim();
    try {
      fields[key] = JSON.parse(rawValue);
    } catch {
      fields[key] = rawValue;
    }
  }
  return { fields, body: normalized.slice(end + 5) };
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function sortedCounts(items, field) {
  const counts = {};
  for (const item of items) counts[item[field]] = (counts[item[field]] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

async function main() {
  if (process.argv.length > 4) throw new Error("unexpected-arguments");
  const configPath = resolveInside(PROJECT_ROOT, process.argv[2] ?? "config/okf.json", "config");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const bundleRoot = resolveInside(
    PROJECT_ROOT,
    process.argv[3] ?? config.output?.bundle_root ?? "knowledge/private/personal",
    "bundle",
  );
  const rawRoot = resolveInside(PROJECT_ROOT, config.input?.yuque_raw_root, "raw-root");
  const manifestBytes = await readFile(resolveInside(rawRoot, "manifest.json", "raw-manifest"));
  const coverage = JSON.parse(await readFile(resolveInside(rawRoot, "coverage.json", "raw-coverage"), "utf8"));
  const reportPath = resolveInside(bundleRoot, "curation.json", "curation-report");
  const report = JSON.parse(await readFile(reportPath, "utf8"));

  assert(report.schema_version === "1.0.0", "unsupported-curation-schema");
  assert(report.okf_version === config.okf_version, "curation-okf-version-mismatch");
  assert(/^[a-f0-9]{64}$/u.test(report.raw_manifest_sha256), "invalid-raw-manifest-sha256");
  assert(createHash("sha256").update(manifestBytes).digest("hex") === report.raw_manifest_sha256, "curation-report-is-stale");
  assert(report.policy?.raw_objects_immutable === true, "raw-immutability-policy-missing");
  assert(report.policy?.stable_source_paths === true, "stable-source-path-policy-missing");
  assert(report.policy?.exact_duplicates?.action === "canonical-with-reference-stubs", "exact-duplicate-policy-invalid");
  assert(report.policy?.near_duplicates?.action === "human-review-only", "near-duplicate-policy-invalid");
  assert(report.policy?.same_titles?.action === "human-review-only", "same-title-policy-invalid");
  assert(Array.isArray(report.items), "curation-items-missing");
  assert(Array.isArray(report.exact_duplicate_groups), "exact-duplicate-groups-missing");
  assert(Array.isArray(report.near_duplicate_pairs), "near-duplicate-pairs-missing");
  assert(Array.isArray(report.title_collision_groups), "title-collision-groups-missing");
  assert(report.raw_coverage?.complete === Boolean(coverage.complete), "raw-coverage-complete-mismatch");
  assert(report.raw_coverage?.errors === (coverage.counts?.errors ?? coverage.errors?.length ?? 0), "raw-coverage-errors-mismatch");
  assert(report.raw_coverage?.warnings === (coverage.counts?.warnings ?? coverage.warnings?.length ?? 0), "raw-coverage-warnings-mismatch");

  const itemById = new Map();
  const conceptFiles = new Map();
  for (const item of report.items) {
    assert(!itemById.has(item.concept_id), `duplicate-curation-item:${item.concept_id}`);
    const relative = conceptRelative(item.concept_id);
    const expectedPattern = item.kind === "document"
      ? /^yuque\/documents\/\d+\/\d+\.md$/u
      : /^yuque\/notes\/\d+\.md$/u;
    assert(expectedPattern.test(relative), `unstable-source-concept-path:${item.concept_id}`);
    const file = resolveInside(bundleRoot, relative, "concept");
    const details = await lstat(file);
    assert(details.isFile() && !details.isSymbolicLink(), `concept-not-regular-file:${item.concept_id}`);
    const parsed = parseFrontmatter(await readFile(file, "utf8"), item.concept_id);
    assert(parsed.fields.source_id === item.source_id, `source-id-mismatch:${item.concept_id}`);
    assert(parsed.fields.content_quality === item.content_quality, `content-quality-mismatch:${item.concept_id}`);
    assert(parsed.fields.curation_status === item.curation_status, `curation-status-mismatch:${item.concept_id}`);
    assert(parsed.fields.review_status === item.review_status, `review-status-mismatch:${item.concept_id}`);
    assert(parsed.fields.raw_manifest_sha256 === report.raw_manifest_sha256, `manifest-sha-mismatch:${item.concept_id}`);
    itemById.set(item.concept_id, item);
    conceptFiles.set(item.concept_id, parsed);
  }

  assert(itemById.size === report.counts?.total_items, "total-item-count-mismatch");
  assert(JSON.stringify(sortedCounts(report.items, "content_quality")) === JSON.stringify(report.counts.content_quality), "quality-counts-mismatch");
  assert(JSON.stringify(sortedCounts(report.items, "curation_status")) === JSON.stringify(report.counts.curation_status), "status-counts-mismatch");
  const reviewQueueItems = report.items.filter((item) => item.curation_status === "needs-review"
    || item.title_derived === true
    || item.near_duplicates.length > 0
    || item.title_collision_group !== null);
  assert(reviewQueueItems.length === report.counts.review_queue_items, "review-queue-count-mismatch");
  assert(report.items.filter((item) => item.content_quality === "archived").length === report.counts.archived_items, "archived-count-mismatch");

  const groupedMembers = new Set();
  let redundantExactCopies = 0;
  for (const group of report.exact_duplicate_groups) {
    assert(typeof group.id === "string" && group.id.startsWith("exact-"), "exact-group-id-invalid");
    assert(Array.isArray(group.member_concept_ids) && group.member_concept_ids.length >= 2, `exact-group-too-small:${group.id}`);
    assert(group.member_concept_ids.includes(group.canonical_concept_id), `exact-canonical-not-member:${group.id}`);
    const canonical = itemById.get(group.canonical_concept_id);
    assert(canonical, `exact-canonical-missing:${group.id}`);
    assert(canonical.duplicate_group === group.id, `exact-canonical-group-mismatch:${group.id}`);
    assert(canonical.duplicate_of === null, `exact-canonical-has-parent:${group.id}`);
    for (const conceptId of group.member_concept_ids) {
      assert(!groupedMembers.has(conceptId), `concept-in-multiple-exact-groups:${conceptId}`);
      groupedMembers.add(conceptId);
      const item = itemById.get(conceptId);
      assert(item, `exact-member-missing:${conceptId}`);
      assert(item.content_fingerprint === group.fingerprint, `exact-fingerprint-mismatch:${conceptId}`);
      assert(item.duplicate_group === group.id, `exact-member-group-mismatch:${conceptId}`);
      if (conceptId === group.canonical_concept_id) continue;
      assert(item.curation_status === "duplicate", `exact-member-not-duplicate:${conceptId}`);
      assert(item.duplicate_of === group.canonical_concept_id, `exact-member-parent-mismatch:${conceptId}`);
      const parsed = conceptFiles.get(conceptId);
      assert(parsed.fields.duplicate_of === group.canonical_concept_id, `duplicate-frontmatter-parent-mismatch:${conceptId}`);
      assert(parsed.body.includes(`(${group.canonical_concept_id})`), `duplicate-body-link-missing:${conceptId}`);
    }
    redundantExactCopies += group.member_concept_ids.length - 1;
  }
  assert(report.exact_duplicate_groups.length === report.counts.exact_duplicate_groups, "exact-group-count-mismatch");
  assert(redundantExactCopies === report.counts.redundant_exact_copies, "redundant-exact-count-mismatch");

  const nearPairKeys = new Set();
  for (const pair of report.near_duplicate_pairs) {
    assert(Array.isArray(pair.concept_ids) && pair.concept_ids.length === 2, "near-pair-shape-invalid");
    const [leftId, rightId] = pair.concept_ids;
    assert(leftId !== rightId, `near-pair-self-reference:${leftId}`);
    const pairKey = [...pair.concept_ids].sort().join("\u0000");
    assert(!nearPairKeys.has(pairKey), `near-pair-duplicate:${pairKey}`);
    nearPairKeys.add(pairKey);
    const left = itemById.get(leftId);
    const right = itemById.get(rightId);
    assert(left && right, `near-pair-member-missing:${pairKey}`);
    assert(left.curation_status !== "duplicate" && right.curation_status !== "duplicate", `near-pair-contains-exact-duplicate:${pairKey}`);
    assert(Number(pair.similarity) >= Number(report.policy.near_duplicates.threshold), `near-pair-below-threshold:${pairKey}`);
    assert(left.near_duplicates.some((match) => match.conceptId === rightId && match.similarity === pair.similarity), `near-pair-left-backlink-missing:${pairKey}`);
    assert(right.near_duplicates.some((match) => match.conceptId === leftId && match.similarity === pair.similarity), `near-pair-right-backlink-missing:${pairKey}`);
    const leftLinks = conceptFiles.get(leftId).fields.near_duplicates;
    const rightLinks = conceptFiles.get(rightId).fields.near_duplicates;
    assert(Array.isArray(leftLinks) && leftLinks.includes(rightId), `near-pair-left-frontmatter-missing:${pairKey}`);
    assert(Array.isArray(rightLinks) && rightLinks.includes(leftId), `near-pair-right-frontmatter-missing:${pairKey}`);
  }
  assert(report.near_duplicate_pairs.length === report.counts.near_duplicate_pairs, "near-pair-count-mismatch");

  const titleCollisionMembers = new Set();
  for (const group of report.title_collision_groups) {
    assert(typeof group.id === "string" && group.id.startsWith("title-"), "title-collision-id-invalid");
    assert(typeof group.normalized_title === "string" && group.normalized_title.length > 0, `title-collision-key-invalid:${group.id}`);
    assert(Array.isArray(group.member_concept_ids) && group.member_concept_ids.length >= 2, `title-collision-too-small:${group.id}`);
    const fingerprints = new Set();
    for (const conceptId of group.member_concept_ids) {
      assert(!titleCollisionMembers.has(conceptId), `concept-in-multiple-title-groups:${conceptId}`);
      titleCollisionMembers.add(conceptId);
      const item = itemById.get(conceptId);
      assert(item, `title-collision-member-missing:${conceptId}`);
      assert(item.title_collision_group === group.id, `title-collision-group-mismatch:${conceptId}`);
      const expectedRelated = group.member_concept_ids.filter((candidate) => candidate !== conceptId).sort();
      assert(JSON.stringify([...item.same_title_concepts].sort()) === JSON.stringify(expectedRelated), `same-title-report-links-mismatch:${conceptId}`);
      const parsed = conceptFiles.get(conceptId);
      assert(parsed.fields.title_collision_group === group.id, `title-collision-frontmatter-mismatch:${conceptId}`);
      assert(JSON.stringify([...parsed.fields.same_title_concepts].sort()) === JSON.stringify(expectedRelated), `same-title-frontmatter-links-mismatch:${conceptId}`);
      fingerprints.add(item.content_fingerprint ?? `missing:${conceptId}`);
    }
    assert(fingerprints.size >= 2, `title-collision-bodies-not-distinct:${group.id}`);
  }
  assert(report.title_collision_groups.length === report.counts.title_collision_groups, "title-collision-group-count-mismatch");
  assert(titleCollisionMembers.size === report.counts.title_collision_items, "title-collision-item-count-mismatch");

  const reportConcept = resolveInside(bundleRoot, "yuque/curation-report.md", "curation-concept");
  const reportDetails = await lstat(reportConcept);
  assert(reportDetails.isFile() && !reportDetails.isSymbolicLink(), "curation-concept-missing");

  process.stdout.write(`${JSON.stringify({
    verified: true,
    items: report.items.length,
    exact_duplicate_groups: report.exact_duplicate_groups.length,
    redundant_exact_copies: redundantExactCopies,
    near_duplicate_pairs: report.near_duplicate_pairs.length,
    title_collision_groups: report.title_collision_groups.length,
    review_queue_items: report.counts.review_queue_items,
  })}\n`);
}

main().catch((error) => {
  const reason = String(error?.message ?? error ?? "unknown").replace(/[\r\n]+/gu, " ").slice(0, 300);
  process.stderr.write(`[verify-okf-curation] fatal=${JSON.stringify(reason)}\n`);
  process.exitCode = 1;
});
