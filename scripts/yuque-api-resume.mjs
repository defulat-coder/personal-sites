import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawRoot = path.join(projectRoot, "data/private/yuque/raw");
const runtimeRoot = path.join(projectRoot, "var/yuque-sync");
const checkpointPath = path.join(runtimeRoot, "api-checkpoint.json");
const baseUrl = "https://www.yuque.com/api/v2";
const token = process.env.YUQUE_TOKEN || process.env.YUQUE_PERSONAL_TOKEN;
const noteStatuses = [0, 9];
const notePageSize = 20;
const concurrency = 4;
const timeoutMs = 30_000;
const checkpointEvery = 25;
const rateLimitProbeMs = 60_000;

const progress = {
  requests: 0,
  rate_limit_probes: 0,
  transient_retries: 0,
  stored: 0,
  errors: 0,
  enumerated_docs: 0,
  legacy_docs: 0,
  ymd_docs: 0,
  note_pages: 0,
  note_ids: 0,
  notes: 0,
  boards: 0,
};

let phase = "scan";
let checkpointQueue = Promise.resolve();
let rateLimitRecovery = null;

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}

function canonicalBytes(value) {
  return Buffer.from(`${JSON.stringify(sortValue(value), null, 2)}\n`, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safeSegment(value) {
  const safe = String(value).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return safe || sha256(Buffer.from(String(value))).slice(0, 24);
}

async function writeAtomic(target, bytes) {
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporary, bytes, { mode: 0o600 });
  await rename(temporary, target);
}

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function storeJson(kind, sourceId, payload) {
  const bytes = canonicalBytes(payload);
  const digest = sha256(bytes);
  const target = path.join(rawRoot, "objects", safeSegment(kind), safeSegment(sourceId), `${digest}.json`);
  if (!(await pathExists(target))) await writeAtomic(target, bytes);
  progress.stored += 1;
  if (progress.stored % checkpointEvery === 0) await writeCheckpoint();
  return target;
}

function countsOnly() {
  return Object.fromEntries(Object.entries(progress).sort(([left], [right]) => left.localeCompare(right)));
}

function logCounts() {
  console.log(JSON.stringify(countsOnly()));
}

async function writeCheckpointNow() {
  const checkpoint = {
    schema_version: "1.0.0",
    phase,
    updated_at: new Date().toISOString(),
    counts: countsOnly(),
  };
  await writeAtomic(checkpointPath, canonicalBytes(checkpoint));
}

async function writeCheckpoint() {
  checkpointQueue = checkpointQueue.then(writeCheckpointNow, writeCheckpointNow);
  await checkpointQueue;
}

async function request(url) {
  progress.requests += 1;
  return fetch(url, {
    headers: { "X-Auth-Token": token, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function recoverFromRateLimit(url) {
  const owner = rateLimitRecovery === null;
  if (owner) {
    const recovery = (async () => {
      while (true) {
        await wait(rateLimitProbeMs);
        progress.rate_limit_probes += 1;
        logCounts();
        try {
          const response = await request(url);
          if (response.status !== 429) return response;
        } catch {
          progress.transient_retries += 1;
        }
      }
    })();
    rateLimitRecovery = recovery;
    recovery.finally(() => {
      if (rateLimitRecovery === recovery) rateLimitRecovery = null;
    }).catch(() => {});
  }
  const response = await rateLimitRecovery;
  return owner ? response : null;
}

async function fetchApi(apiPath, query = {}) {
  const url = new URL(`${baseUrl}${apiPath}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  let transientAttempt = 0;
  while (true) {
    if (rateLimitRecovery) {
      await rateLimitRecovery;
      continue;
    }

    let response;
    try {
      response = await request(url);
    } catch {
      transientAttempt += 1;
      progress.transient_retries += 1;
      if (transientAttempt >= 5) throw new Error("network_error");
      await wait(Math.min(30_000, 750 * 2 ** (transientAttempt - 1)));
      continue;
    }

    if (response.status === 429) {
      const probeResponse = await recoverFromRateLimit(url);
      if (!probeResponse) continue;
      response = probeResponse;
    }
    if (response.ok) {
      const body = await response.json();
      return body.data;
    }
    if (response.status >= 500 && transientAttempt < 4) {
      transientAttempt += 1;
      progress.transient_retries += 1;
      await wait(Math.min(30_000, 750 * 2 ** (transientAttempt - 1)));
      continue;
    }
    throw new Error(`http_${response.status}`);
  }
}

async function sourceDirectories(kind) {
  const root = path.join(rawRoot, "objects", kind);
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => ({ name: entry.name, path: path.join(root, entry.name) }));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function latestJson(directory) {
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"));
  if (entries.length === 0) return null;
  const candidates = await Promise.all(entries.map(async (entry) => {
    const file = path.join(directory, entry.name);
    return { file, modified: (await stat(file)).mtimeMs };
  }));
  candidates.sort((left, right) => right.modified - left.modified || left.file.localeCompare(right.file));
  return JSON.parse(await readFile(candidates[0].file, "utf8"));
}

async function existingIds(kind) {
  const result = new Set();
  for (const entry of await sourceDirectories(kind)) {
    const files = await readdir(entry.path, { withFileTypes: true });
    if (files.some((file) => file.isFile() && file.name.endsWith(".json"))) result.add(entry.name);
  }
  return result;
}

function addDoc(documents, id, repoId) {
  if (id === undefined || id === null) return;
  const key = String(id);
  const repo = repoId === undefined || repoId === null ? null : String(repoId);
  if (!documents.has(key) || (!documents.get(key) && repo)) documents.set(key, repo);
}

async function rebuildDocuments() {
  const documents = new Map();
  for (const entry of await sourceDirectories("doc-list-page")) {
    try {
      const payload = await latestJson(entry.path);
      if (!Array.isArray(payload)) continue;
      const repoFromKey = entry.name.match(/^(\d+)_\d+$/)?.[1] ?? null;
      for (const doc of payload) addDoc(documents, doc?.id, doc?.book_id ?? repoFromKey);
    } catch {
      progress.errors += 1;
    }
  }
  for (const entry of await sourceDirectories("toc")) {
    try {
      const payload = await latestJson(entry.path);
      if (!Array.isArray(payload)) continue;
      for (const item of payload) addDoc(documents, item?.doc_id, entry.name);
    } catch {
      progress.errors += 1;
    }
  }
  return documents;
}

async function rebuildNotePages() {
  const pages = new Map(noteStatuses.map((status) => [status, new Map()]));
  const noteIds = new Set();
  for (const entry of await sourceDirectories("note-list-page")) {
    const match = entry.name.match(/^(-?\d+)_(\d+)$/);
    if (!match) continue;
    const status = Number(match[1]);
    const offset = Number(match[2]);
    if (!pages.has(status)) continue;
    try {
      const payload = await latestJson(entry.path);
      if (!payload || typeof payload !== "object") continue;
      pages.get(status).set(offset, payload);
      collectNoteIds(payload, noteIds);
    } catch {
      progress.errors += 1;
    }
  }
  return { pages, noteIds };
}

function collectNoteIds(page, target) {
  for (const note of [...(page?.pin_notes ?? []), ...(page?.notes ?? [])]) {
    if (note?.id !== undefined && note?.id !== null) target.add(String(note.id));
  }
}

async function mapLimit(items, limit, mapper) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await mapper(items[index]);
    }
  });
  await Promise.all(workers);
}

async function supplementLegacy(documents, existing) {
  const missing = [...documents].filter(([id, repoId]) => repoId && !existing.has(safeSegment(id)));
  await mapLimit(missing, concurrency, async ([id, repoId]) => {
    try {
      const payload = await fetchApi(`/repos/${encodeURIComponent(repoId)}/docs/${encodeURIComponent(id)}`);
      await storeJson("doc-legacy", id, payload);
      existing.add(safeSegment(id));
    } catch {
      progress.errors += 1;
    }
  });
}

async function continueNotePages(pages, noteIds) {
  for (const status of noteStatuses) {
    const statusPages = pages.get(status);
    const offsets = [...statusPages.keys()];
    const highest = offsets.length > 0 ? Math.max(...offsets) : null;
    let offset = highest === null ? 0 : highest + notePageSize;
    let hasMore = highest === null || Boolean(statusPages.get(highest)?.has_more);
    while (hasMore) {
      const before = noteIds.size;
      const payload = await fetchApi("/notes", { status, offset, limit: notePageSize });
      await storeJson("note-list-page", `${status}:${offset}`, payload);
      statusPages.set(offset, payload);
      collectNoteIds(payload, noteIds);
      hasMore = Boolean(payload?.has_more);
      if (hasMore && noteIds.size === before) throw new Error("note_pagination_did_not_advance");
      offset += notePageSize;
    }
  }
}

async function supplementNotes(noteIds, existing) {
  const missing = [...noteIds].filter((id) => !existing.has(safeSegment(id)));
  await mapLimit(missing, concurrency, async (id) => {
    try {
      await storeJson("note", id, await fetchApi(`/notes/${encodeURIComponent(id)}`));
      existing.add(safeSegment(id));
    } catch {
      progress.errors += 1;
    }
  });
}

async function supplementYmd(documents, existing) {
  const missing = [...documents.keys()].filter((id) => !existing.has(safeSegment(id)));
  await mapLimit(missing, concurrency, async (id) => {
    try {
      await storeJson("doc-ymd", id, await fetchApi("/yfm/docs", { doc_id: id }));
      existing.add(safeSegment(id));
    } catch {
      progress.errors += 1;
    }
  });
}

function boardReferences(value, contextId, target) {
  if (typeof value !== "string" || value.length === 0) return;
  const pattern = /board:\/\/([a-zA-Z0-9._~%:+/-]+)/g;
  for (const match of value.matchAll(pattern)) {
    const resourceId = match[1].replace(/[.,;:!?]+$/, "");
    target.set(`${contextId}:${resourceId}`, { contextId: String(contextId), resourceId });
  }
}

async function collectBoardsFromKind(kind, target) {
  for (const entry of await sourceDirectories(kind)) {
    try {
      const payload = await latestJson(entry.path);
      if (!payload) continue;
      if (kind === "doc-legacy") {
        boardReferences(payload.body, entry.name, target);
        boardReferences(payload.body_html, entry.name, target);
        boardReferences(payload.body_lake, entry.name, target);
      } else if (kind === "doc-ymd") {
        boardReferences(payload.yfm, String(payload.doc_id ?? entry.name), target);
      } else if (kind === "note") {
        boardReferences(payload.content?.source, `note-${entry.name}`, target);
        boardReferences(payload.content?.html, `note-${entry.name}`, target);
      }
    } catch {
      progress.errors += 1;
    }
  }
}

function boardSourceId(contextId, resourceId) {
  return `${contextId}:${sha256(Buffer.from(resourceId)).slice(0, 24)}`;
}

async function supplementBoards(existing) {
  const references = new Map();
  await collectBoardsFromKind("doc-legacy", references);
  await collectBoardsFromKind("doc-ymd", references);
  await collectBoardsFromKind("note", references);
  const missing = [...references.values()].filter(({ contextId, resourceId }) => (
    !existing.has(safeSegment(boardSourceId(contextId, resourceId)))
  ));
  await mapLimit(missing, concurrency, async ({ contextId, resourceId }) => {
    try {
      const payload = await fetchApi("/yfm/boards", { doc_id: contextId, src: resourceId });
      const sourceId = boardSourceId(contextId, resourceId);
      await storeJson("board", sourceId, payload);
      existing.add(safeSegment(sourceId));
    } catch {
      progress.errors += 1;
    }
  });
}

async function refreshCounts(documents, legacy, ymd, pages, noteIds, notes, boards) {
  progress.enumerated_docs = documents.size;
  progress.legacy_docs = legacy.size;
  progress.ymd_docs = ymd.size;
  progress.note_pages = [...pages.values()].reduce((sum, statusPages) => sum + statusPages.size, 0);
  progress.note_ids = noteIds.size;
  progress.notes = notes.size;
  progress.boards = boards.size;
}

async function main() {
  if (!token) {
    progress.errors += 1;
    logCounts();
    process.exitCode = 1;
    return;
  }
  await mkdir(rawRoot, { recursive: true, mode: 0o700 });
  await mkdir(runtimeRoot, { recursive: true, mode: 0o700 });

  const documents = await rebuildDocuments();
  const legacy = await existingIds("doc-legacy");
  const ymd = await existingIds("doc-ymd");
  const notes = await existingIds("note");
  const boards = await existingIds("board");
  const { pages, noteIds } = await rebuildNotePages();
  await refreshCounts(documents, legacy, ymd, pages, noteIds, notes, boards);
  await writeCheckpoint();
  logCounts();

  phase = "legacy";
  await supplementLegacy(documents, legacy);
  phase = "ymd";
  await supplementYmd(documents, ymd);
  phase = "note-pages";
  await continueNotePages(pages, noteIds);
  phase = "notes";
  await supplementNotes(noteIds, notes);
  phase = "boards";
  await supplementBoards(boards);
  phase = "complete";
  await refreshCounts(documents, legacy, ymd, pages, noteIds, notes, boards);
  await writeCheckpoint();
  logCounts();
  if (progress.errors > 0) process.exitCode = 1;
}

await main().catch(async () => {
  progress.errors += 1;
  phase = "failed";
  try { await writeCheckpoint(); } catch {}
  logCounts();
  process.exitCode = 1;
});
