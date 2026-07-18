#!/usr/bin/env node

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { mergeRepositoryCollections, planInventoryUpdate } from "./lib/github-inventory.mjs";
import { assertRegularFile, resolveInside, sha256 } from "./lib/private-file-integrity.mjs";

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const RELATIONSHIP_ORDER = ["owned", "starred", "watched"];
const COLLECTIONS = {
  owned: {
    endpoint: "user/repos?affiliation=owner&visibility=all&sort=updated&direction=desc&per_page=100",
    accept: "application/vnd.github+json",
  },
  starred: {
    endpoint: "user/starred?sort=created&direction=desc&per_page=100",
    accept: "application/vnd.github.star+json",
  },
  watched: {
    endpoint: "user/subscriptions?per_page=100",
    accept: "application/vnd.github+json",
  },
};

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function safeReason(error) {
  return String(error?.message ?? error ?? "unknown")
    .replace(/ghp_[A-Za-z0-9_]+/gu, "[redacted]")
    .replace(/github_pat_[A-Za-z0-9_]+/gu, "[redacted]")
    .replace(/[\r\n]+/gu, " ")
    .slice(0, 240);
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

async function atomicWrite(file, bytes, mode = 0o600) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${randomUUID()}`;
  await writeFile(temporary, bytes, { mode, flag: "wx" });
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

class GitHubApiError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

async function ghApi(endpoint, {
  accept = "application/vnd.github+json",
  apiVersion,
  paginate = false,
  withRaw = false,
} = {}) {
  const args = ["api"];
  if (paginate) args.push("--paginate", "--slurp");
  args.push("-H", `Accept: ${accept}`);
  args.push("-H", `X-GitHub-Api-Version: ${apiVersion}`);
  args.push(endpoint);
  try {
    const { stdout } = await execFileAsync("gh", args, {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: process.env,
    });
    const rawBytes = Buffer.from(stdout || "null", "utf8");
    const parsed = JSON.parse(rawBytes.toString("utf8"));
    const data = paginate ? (Array.isArray(parsed) ? parsed.flat() : []) : parsed;
    return withRaw ? { data, rawBytes } : data;
  } catch (error) {
    const diagnostic = `${error?.stderr ?? ""} ${error?.message ?? ""}`;
    const status = Number(diagnostic.match(/HTTP\s+(\d{3})/iu)?.[1] ?? 0) || null;
    throw new GitHubApiError(safeReason(error?.stderr || error), status);
  }
}

async function mapWithConcurrency(values, concurrency, operation) {
  const results = new Array(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(values.length, 1)) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await operation(values[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function sortRelationships(values) {
  const set = new Set(values);
  return RELATIONSHIP_ORDER.filter((relationship) => set.has(relationship));
}

async function loadPreviousInventory(rawRoot) {
  const manifestPath = resolveInside(rawRoot, "manifest.json", "manifest");
  if (!(await fileExists(manifestPath))) return { manifest: null, records: [] };
  await assertRegularFile(manifestPath, rawRoot, "manifest");
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (manifest.schema_version !== "1.0.0" || manifest.source_system !== "github") {
    throw new Error("github-manifest-schema-unsupported");
  }
  const records = [];
  for (const object of manifest.objects ?? []) {
    if (object.kind !== "repository" || !/^[a-f0-9]{64}$/u.test(object.sha256 ?? "")) {
      throw new Error("github-manifest-object-invalid");
    }
    const file = resolveInside(rawRoot, object.path, "repository-object");
    await assertRegularFile(file, rawRoot, "repository-object");
    const bytes = await readFile(file);
    if (sha256(bytes) !== object.sha256) throw new Error(`github-object-hash-mismatch:${object.source_id}`);
    const payload = JSON.parse(bytes.toString("utf8"));
    if (payload.schema_version !== "1.0.0" || payload.kind !== "repository" || payload.source_id !== object.source_id) {
      throw new Error(`github-object-payload-invalid:${object.source_id}`);
    }
    records.push(payload.record);
  }
  return { manifest, manifestBytes, records };
}

function retainFailedCollectionRelationships(current, previous, failedCollections) {
  if (failedCollections.size === 0) return current;
  const currentById = new Map(current.map((record) => [record.sourceId, record]));
  for (const previousRecord of previous) {
    if (!previousRecord.active) continue;
    const retained = previousRecord.relationships.filter((relationship) => failedCollections.has(relationship));
    if (retained.length === 0) continue;
    const existing = currentById.get(previousRecord.sourceId) ?? {
      ...previousRecord,
      relationships: [],
      active: true,
      inactiveSince: null,
      previousRelationships: [],
    };
    existing.relationships = sortRelationships([...existing.relationships, ...retained]);
    if (retained.includes("starred") && !existing.starredAt) existing.starredAt = previousRecord.starredAt;
    currentById.set(previousRecord.sourceId, existing);
  }
  return [...currentById.values()].sort((left, right) => left.sourceId.localeCompare(right.sourceId, "en", { numeric: true }));
}

function attachPreviousReadmes(current, previous) {
  const previousById = new Map(previous.map((record) => [record.sourceId, record]));
  return current.map((record) => ({
    ...record,
    readme: previousById.get(record.sourceId)?.readme ?? null,
  }));
}

async function refreshOwnedReadmes({ current, previous, rawRoot, config, observedAt, warnings }) {
  if (config.readme?.owned_non_forks !== true) return current;
  const previousById = new Map(previous.map((record) => [record.sourceId, record]));
  const candidates = current.filter((record) => record.relationships.includes("owned") && !record.repository.fork);
  const maxBytes = Number(config.readme?.max_bytes ?? 1048576);
  const concurrency = Number(config.readme?.concurrency ?? 4);
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error("github-readme-max-bytes-invalid");
  if (!Number.isSafeInteger(concurrency) || concurrency <= 0 || concurrency > 16) throw new Error("github-readme-concurrency-invalid");

  const updates = await mapWithConcurrency(candidates, concurrency, async (record) => {
    const previousRecord = previousById.get(record.sourceId);
    if (previousRecord?.readme && previousRecord.repository?.pushed_at === record.repository.pushed_at) {
      return [record.sourceId, previousRecord.readme];
    }
    const endpoint = `repos/${encodeURIComponent(record.repository.owner.login)}/${encodeURIComponent(record.repository.name)}/readme`;
    try {
      const payload = await ghApi(endpoint, { apiVersion: config.api_version });
      if (payload?.encoding !== "base64" || typeof payload.content !== "string") {
        warnings.push({ code: "readme-encoding-unsupported", source_id: record.sourceId });
        return [record.sourceId, previousRecord?.readme ?? null];
      }
      const bytes = Buffer.from(payload.content.replace(/\s+/gu, ""), "base64");
      if (bytes.length > maxBytes) {
        warnings.push({ code: "readme-too-large", source_id: record.sourceId, bytes: bytes.length });
        return [record.sourceId, previousRecord?.readme ?? {
          status: "too-large",
          size: bytes.length,
          pushed_at: record.repository.pushed_at,
        }];
      }
      const digest = sha256(bytes);
      const relative = `blobs/readme/${digest.slice(0, 2)}/${digest}.bin`;
      await writeContentAddressed(rawRoot, relative, bytes);
      return [record.sourceId, {
        status: "available",
        name: String(payload.name ?? "README"),
        path: relative,
        sha256: digest,
        size: bytes.length,
        html_url: typeof payload.html_url === "string" ? payload.html_url : null,
        download_url: typeof payload.download_url === "string" ? payload.download_url : null,
        pushed_at: record.repository.pushed_at,
        fetched_at: observedAt,
      }];
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) {
        return [record.sourceId, {
          status: "missing",
          pushed_at: record.repository.pushed_at,
          checked_at: observedAt,
        }];
      }
      warnings.push({ code: "readme-fetch-failed", source_id: record.sourceId, detail: safeReason(error) });
      return [record.sourceId, previousRecord?.readme ?? null];
    }
  });
  const readmeById = new Map(updates);
  return current.map((record) => ({
    ...record,
    readme: readmeById.has(record.sourceId) ? readmeById.get(record.sourceId) : record.readme,
  }));
}

async function refreshDeactivatedRemoteStatus({ planned, previous, config, warnings }) {
  const previousById = new Map(previous.map((record) => [record.sourceId, record]));
  const newlyDeactivated = planned.changes
    .filter((change) => change.deactivated)
    .map((change) => planned.records.find((record) => record.sourceId === change.sourceId));
  const updates = await mapWithConcurrency(newlyDeactivated, 4, async (record) => {
    const endpoint = `repos/${encodeURIComponent(record.repository.owner.login)}/${encodeURIComponent(record.repository.name)}`;
    try {
      await ghApi(endpoint, { apiVersion: config.api_version });
      return [record.sourceId, "available"];
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) return [record.sourceId, "not-found"];
      if (error instanceof GitHubApiError && error.status === 403) return [record.sourceId, "inaccessible"];
      warnings.push({ code: "remote-status-check-failed", source_id: record.sourceId, detail: safeReason(error) });
      return [record.sourceId, previousById.get(record.sourceId)?.remoteStatus ?? "unknown"];
    }
  });
  const statusById = new Map(updates);
  planned.records = planned.records.map((record) => statusById.has(record.sourceId)
    ? { ...record, remoteStatus: statusById.get(record.sourceId) }
    : record);
}

function inventoryCounts(records) {
  const active = records.filter((record) => record.active);
  const relationshipCount = (relationship) => active.filter((record) => record.relationships.includes(relationship)).length;
  return {
    repositories: records.length,
    active: active.length,
    inactive: records.length - active.length,
    owned: relationshipCount("owned"),
    starred: relationshipCount("starred"),
    watched: relationshipCount("watched"),
    owned_originals: active.filter((record) => record.relationships.includes("owned") && !record.repository.fork).length,
    owned_forks: active.filter((record) => record.relationships.includes("owned") && record.repository.fork).length,
    private: active.filter((record) => record.repository.private).length,
    archived: active.filter((record) => record.repository.archived).length,
    readmes: active.filter((record) => record.readme?.status === "available").length,
  };
}

function canReuseManifest({
  previousManifest,
  changes,
  complete,
  config,
  account,
  counts,
  collectionSummary,
  rawResponseObjects,
  warnings,
  errors,
}) {
  return Boolean(previousManifest)
    && changes.length === 0
    && previousManifest.complete === complete
    && previousManifest.api_version === config.api_version
    && previousManifest.account?.id === String(account.id)
    && previousManifest.account?.login === account.login
    && JSON.stringify(previousManifest.counts) === JSON.stringify(counts)
    && JSON.stringify(previousManifest.collections) === JSON.stringify(collectionSummary)
    && JSON.stringify(previousManifest.raw_responses) === JSON.stringify(rawResponseObjects)
    && JSON.stringify(previousManifest.warnings) === JSON.stringify(warnings)
    && JSON.stringify(previousManifest.errors) === JSON.stringify(errors);
}

async function persistInventory({
  rawRoot,
  config,
  account,
  collections,
  rawResponses,
  planned,
  warnings,
  errors,
  observedAt,
  previousManifest,
  previousManifestBytes,
}) {
  const counts = inventoryCounts(planned.records);
  const collectionSummary = Object.fromEntries(RELATIONSHIP_ORDER.map((relationship) => [relationship, {
    endpoint: COLLECTIONS[relationship].endpoint,
    count: collections[relationship].items.length,
    complete: collections[relationship].complete,
  }]));
  const complete = errors.length === 0 && Object.values(collectionSummary).every((collection) => collection.complete);
  const rawResponseObjects = [];
  for (const response of rawResponses) {
    const digest = sha256(response.bytes);
    const relative = `responses/${response.kind}/${digest}.json`;
    await writeContentAddressed(rawRoot, relative, response.bytes);
    rawResponseObjects.push({
      kind: response.kind,
      sha256: digest,
      path: relative,
      item_count: response.itemCount,
    });
  }
  const noChange = canReuseManifest({
    previousManifest,
    changes: planned.changes,
    complete,
    config,
    account,
    counts,
    collectionSummary,
    rawResponseObjects,
    warnings,
    errors,
  });

  if (noChange) {
    const manifestSha = sha256(previousManifestBytes);
    const previousStatePath = resolveInside(rawRoot, "state.json", "state");
    let previousState = {};
    if (await fileExists(previousStatePath)) previousState = JSON.parse(await readFile(previousStatePath, "utf8"));
    await atomicWrite(previousStatePath, stableJson({
      schema_version: "1.0.0",
      source_system: "github",
      last_checked_at: observedAt,
      last_changed_at: previousState.last_changed_at ?? previousManifest.snapshot_at,
      last_check_changed: false,
      last_check_changes: 0,
      manifest_sha256: manifestSha,
      complete,
    }));
    return { changed: false, manifestSha, manifest: previousManifest, counts };
  }

  const objects = [];
  for (const record of planned.records) {
    const payload = {
      schema_version: "1.0.0",
      kind: "repository",
      source_system: "github",
      source_id: record.sourceId,
      record,
    };
    const bytes = Buffer.from(stableJson(payload), "utf8");
    const digest = sha256(bytes);
    const relative = `objects/repository/${record.sourceId}/${digest}.json`;
    await writeContentAddressed(rawRoot, relative, bytes);
    objects.push({
      kind: "repository",
      source_id: record.sourceId,
      sha256: digest,
      path: relative,
      active: record.active,
      relationships: record.relationships,
      remote_status: record.remoteStatus,
    });
  }
  const manifest = {
    schema_version: "1.0.0",
    source_system: "github",
    api_version: config.api_version,
    account: {
      id: String(account.id),
      login: account.login,
      name: account.name ?? null,
      html_url: account.html_url,
    },
    snapshot_at: observedAt,
    complete,
    collections: collectionSummary,
    counts,
    raw_responses: rawResponseObjects,
    objects,
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
    source_system: "github",
    last_checked_at: observedAt,
    last_changed_at: observedAt,
    last_check_changed: true,
    last_check_changes: planned.changes.length,
    manifest_sha256: manifestSha,
    complete,
  }));
  return { changed: true, manifestSha, manifest, counts };
}

async function main() {
  if (process.argv.slice(2).length > 0) throw new Error("unexpected-arguments");
  const configPath = resolveInside(PROJECT_ROOT, "config/github-sync.json", "config");
  await assertRegularFile(configPath, PROJECT_ROOT, "config");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (config.schema_version !== "1.0.0" || config.source_system !== "github") {
    throw new Error("github-sync-config-unsupported");
  }
  const rawRoot = resolveInside(PROJECT_ROOT, config.storage?.raw_root, "raw-root");
  const privateRelative = path.relative(PROJECT_ROOT, rawRoot);
  if (!privateRelative.startsWith(`data${path.sep}private${path.sep}`)) throw new Error("github-raw-root-must-be-private");
  await mkdir(rawRoot, { recursive: true, mode: 0o700 });

  const observedAt = new Date().toISOString();
  const previous = await loadPreviousInventory(rawRoot);
  const accountResponse = await ghApi("user", { apiVersion: config.api_version, withRaw: true });
  const account = accountResponse.data;
  if (account?.login !== config.account) throw new Error(`github-account-mismatch:${account?.login ?? "unknown"}`);

  const collections = {};
  const rawResponses = [{ kind: "account", bytes: accountResponse.rawBytes, itemCount: 1 }];
  const warnings = [];
  const errors = [];
  await Promise.all(RELATIONSHIP_ORDER.map(async (relationship) => {
    if (config.collections?.[relationship] !== true) {
      collections[relationship] = { items: [], complete: true };
      return;
    }
    const definition = COLLECTIONS[relationship];
    try {
      const response = await ghApi(definition.endpoint, {
        accept: definition.accept,
        apiVersion: config.api_version,
        paginate: true,
        withRaw: true,
      });
      collections[relationship] = {
        items: response.data,
        complete: true,
      };
      rawResponses.push({
        kind: relationship,
        bytes: response.rawBytes,
        itemCount: response.data.length,
      });
    } catch (error) {
      collections[relationship] = { items: [], complete: false };
      errors.push({ code: `${relationship}-collection-fetch-failed`, detail: safeReason(error) });
    }
  }));

  const failedCollections = new Set(RELATIONSHIP_ORDER.filter((relationship) => !collections[relationship].complete));
  let current = mergeRepositoryCollections({
    owned: collections.owned.items,
    starred: collections.starred.items,
    watched: collections.watched.items,
  });
  current = retainFailedCollectionRelationships(current, previous.records, failedCollections);
  current = attachPreviousReadmes(current, previous.records);
  current = await refreshOwnedReadmes({ current, previous: previous.records, rawRoot, config, observedAt, warnings });
  const planned = planInventoryUpdate({ current, previous: previous.records, observedAt });
  await refreshDeactivatedRemoteStatus({ planned, previous: previous.records, config, warnings });
  const issueOrder = (left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right));
  warnings.sort(issueOrder);
  errors.sort(issueOrder);
  const persisted = await persistInventory({
    rawRoot,
    config,
    account,
    collections,
    rawResponses: rawResponses.sort((left, right) => left.kind.localeCompare(right.kind)),
    planned,
    warnings,
    errors,
    observedAt,
    previousManifest: previous.manifest,
    previousManifestBytes: previous.manifestBytes,
  });
  process.stdout.write(`${JSON.stringify({
    synced: true,
    changed: persisted.changed,
    complete: persisted.manifest.complete,
    manifest_sha256: persisted.manifestSha,
    changes: planned.changes.length,
    warnings: warnings.length,
    errors: errors.length,
    ...persisted.counts,
  })}\n`);
  if (!persisted.manifest.complete) process.exitCode = 2;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`[github-sync] fatal=${JSON.stringify(safeReason(error))}\n`);
    process.exitCode = 1;
  });
}

export { canReuseManifest, main, retainFailedCollectionRelationships };
