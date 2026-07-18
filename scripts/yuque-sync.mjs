import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  access,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.resolve(projectRoot, process.argv[2] ?? "config/yuque-sync.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const token = process.env.YUQUE_TOKEN || process.env.YUQUE_PERSONAL_TOKEN;
const skipAssets = process.argv.includes("--skip-assets");

if (!token) {
  console.error("YUQUE_TOKEN or YUQUE_PERSONAL_TOKEN is required");
  process.exit(1);
}

const apiConfig = config.api ?? {};
const scope = config.scope ?? {};
const rawRoot = resolveInside(projectRoot, config.storage?.raw_root ?? "data/private/yuque/raw");
const runtimeRoot = resolveInside(projectRoot, config.storage?.runtime_root ?? "var/yuque-sync");
const baseUrl = String(apiConfig.base_url ?? "https://www.yuque.com/api/v2").replace(/\/$/, "");
const concurrency = positiveInteger(apiConfig.concurrency, 4);
const timeoutMs = positiveInteger(apiConfig.timeout_ms, 30_000);
const retryAttempts = positiveInteger(apiConfig.retry?.attempts, 5);
const retryBaseDelayMs = positiveInteger(apiConfig.retry?.base_delay_ms, 750);
const repoPageSize = Math.min(100, positiveInteger(apiConfig.repo_page_size, 100));
const docPageSize = Math.min(100, positiveInteger(apiConfig.doc_page_size, 100));
const notePageSize = Math.min(20, positiveInteger(apiConfig.note_page_size, 20));
const startedAt = new Date();
const objects = [];
const assets = [];
const errors = [];
const assetUrls = new Set();
const boardRefs = new Map();
const bookCoverage = [];
let requestCount = 0;
let rateLimitRemaining = null;
let processedDocs = 0;
let processedNotes = 0;
let rateLimitNoticeShown = false;

await mkdir(rawRoot, { recursive: true, mode: 0o700 });
await mkdir(runtimeRoot, { recursive: true, mode: 0o700 });

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function resolveInside(root, child) {
  const resolved = path.resolve(root, child);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Path escapes project root: ${child}`);
  return resolved;
}

function safeSegment(value) {
  const safe = String(value).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return safe || createHash("sha256").update(String(value)).digest("hex").slice(0, 24);
}

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

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function writeAtomic(target, bytes) {
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporary, bytes, { mode: 0o600 });
  await rename(temporary, target);
}

async function storeBlob(kind, content, extension) {
  if (typeof content !== "string" || content.length === 0) return null;
  const bytes = Buffer.from(content, "utf8");
  const digest = sha256(bytes);
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;
  const relativePath = path.posix.join("blobs", safeSegment(kind), digest.slice(0, 2), `${digest}${normalizedExtension}`);
  const absolutePath = resolveInside(rawRoot, relativePath);
  try {
    await access(absolutePath);
  } catch {
    await writeAtomic(absolutePath, bytes);
  }
  return { format: kind, path: relativePath, sha256: digest, bytes: bytes.length };
}

async function storeJson(kind, sourceId, payload, metadata = {}) {
  const bytes = canonicalBytes(payload);
  const digest = sha256(bytes);
  const relativePath = path.posix.join(
    "objects",
    safeSegment(kind),
    safeSegment(sourceId),
    `${digest}.json`,
  );
  const absolutePath = resolveInside(rawRoot, relativePath);
  try {
    await access(absolutePath);
  } catch {
    await writeAtomic(absolutePath, bytes);
  }
  const record = {
    key: `${kind}:${sourceId}`,
    kind,
    source_id: String(sourceId),
    path: relativePath,
    sha256: digest,
    bytes: bytes.length,
    ...metadata,
  };
  objects.push(record);
  return record;
}

function visibilityOf(value, fallback = "private") {
  if (value?.public === 1 || value?.public === true) return "public";
  if (value?.public === 0 || value?.public === false) return "private";
  return fallback;
}

class SafeRequestError extends Error {
  constructor(status, code) {
    super(code);
    this.name = "SafeRequestError";
    this.status = status ?? null;
    this.code = code;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchApi(apiPath, query = {}) {
  const url = new URL(`${baseUrl}${apiPath}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
    requestCount += 1;
    try {
      const response = await fetch(url, {
        headers: {
          "X-Auth-Token": token,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const remaining = Number(response.headers.get("x-ratelimit-remaining"));
      if (Number.isFinite(remaining)) rateLimitRemaining = remaining;
      if (response.ok) {
        rateLimitNoticeShown = false;
        const body = await response.json();
        return body.data;
      }
      if (response.status === 429) {
        if (!rateLimitNoticeShown) {
          console.log("Yuque sync: hourly API limit reached; waiting 60 seconds before resuming");
          rateLimitNoticeShown = true;
        }
        await wait(60_000);
        attempt -= 1;
        continue;
      }
      if (response.status !== 429 && response.status < 500) {
        throw new SafeRequestError(response.status, `http_${response.status}`);
      }
      if (attempt === retryAttempts) throw new SafeRequestError(response.status, `http_${response.status}`);
      const retryAfter = Number(response.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter)
        ? retryAfter * 1_000
        : retryBaseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
      await wait(delay);
    } catch (error) {
      if (error instanceof SafeRequestError && error.status && error.status < 500 && error.status !== 429) throw error;
      if (attempt === retryAttempts) {
        if (error instanceof SafeRequestError) throw error;
        throw new SafeRequestError(null, error?.name === "TimeoutError" ? "timeout" : "network_error");
      }
      await wait(retryBaseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 250));
    }
  }
  throw new SafeRequestError(null, "request_exhausted");
}

function recordError(kind, sourceId, error) {
  errors.push({
    kind,
    source_id: String(sourceId),
    code: error?.code ?? "request_failed",
    status: Number.isInteger(error?.status) ? error.status : null,
  });
}

async function listByOffset(apiPath, pageSize, pageKind, pageKeyPrefix) {
  const items = [];
  const seen = new Set();
  let complete = false;
  for (let offset = 0; offset < 100_000; offset += pageSize) {
    const page = await fetchApi(apiPath, { offset, limit: pageSize });
    if (!Array.isArray(page)) throw new SafeRequestError(null, "invalid_list_response");
    await storeJson(pageKind, `${pageKeyPrefix}:${offset}`, page);
    let added = 0;
    for (const item of page) {
      const key = String(item?.id ?? item?.slug ?? sha256(canonicalBytes(item)));
      if (!seen.has(key)) {
        seen.add(key);
        items.push(item);
        added += 1;
      }
    }
    if (page.length < pageSize) {
      complete = true;
      break;
    }
    if (added === 0) throw new SafeRequestError(null, "pagination_did_not_advance");
  }
  return { items, complete };
}

async function listNotesByStatus(status) {
  const notes = [];
  const seen = new Set();
  let complete = false;
  for (let offset = 0; offset < 1_000_000; offset += notePageSize) {
    const page = await fetchApi("/notes", { status, offset, limit: notePageSize });
    await storeJson("note-list-page", `${status}:${offset}`, page);
    const pageNotes = [...(page?.pin_notes ?? []), ...(page?.notes ?? [])];
    let added = 0;
    for (const note of pageNotes) {
      if (!seen.has(note.id)) {
        seen.add(note.id);
        notes.push(note);
        added += 1;
      }
    }
    if (!page?.has_more) {
      complete = true;
      break;
    }
    if (added === 0) throw new SafeRequestError(null, "pagination_did_not_advance");
  }
  return { items: notes, complete };
}

async function mapLimit(items, limit, mapper) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
}

function collectTextResources(value, docId) {
  if (typeof value !== "string" || value.length === 0) return;
  const urlPattern = /https?:\/\/[^\s"'<>\\)\]}]+/g;
  for (const match of value.matchAll(urlPattern)) {
    const candidate = match[0].replace(/&amp;/g, "&").replace(/[.,;:!?]+$/, "");
    if (isPotentialAsset(candidate)) assetUrls.add(candidate);
  }
  const boardPattern = /board:\/\/([a-zA-Z0-9._~%:+/-]+)/g;
  for (const match of value.matchAll(boardPattern)) {
    const resourceId = match[1].replace(/[.,;:!?]+$/, "");
    const key = `${docId}:${resourceId}`;
    if (!boardRefs.has(key)) boardRefs.set(key, { docId, resourceId });
  }
}

function isPotentialAsset(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const assetExtension = /\.(?:apng|avif|bmp|csv|docx?|gif|heic|html?|jpe?g|json|m4a|md|mov|mp3|mp4|pdf|png|pptx?|svg|tar|tgz|txt|wav|webm|webp|xlsx?|xml|zip)$/i.test(url.pathname);
    const assetHost = /(^|\.)(?:cdn\.nlark\.com|alicdn\.com|aliyuncs\.com|alipayobjects\.com)$/i.test(url.hostname);
    const yuqueAttachment = /(^|\.)yuque\.com$/i.test(url.hostname) && /\/(?:attachments?|api\/v2\/attachments?|api\/v2\/files?|upload)\//i.test(url.pathname);
    return assetExtension || assetHost || yuqueAttachment;
  } catch {
    return false;
  }
}

function contentExtension(contentType, url) {
  const byType = new Map([
    ["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/gif", ".gif"],
    ["image/webp", ".webp"], ["image/svg+xml", ".svg"], ["application/pdf", ".pdf"],
    ["application/zip", ".zip"], ["text/plain", ".txt"], ["text/csv", ".csv"],
    ["audio/mpeg", ".mp3"], ["video/mp4", ".mp4"],
  ]);
  const normalizedType = String(contentType ?? "").split(";")[0].trim().toLowerCase();
  if (byType.has(normalizedType)) return byType.get(normalizedType);
  const extension = path.extname(new URL(url).pathname).toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(extension) ? extension : ".bin";
}

async function downloadAsset(sourceUrl) {
  const sourceHash = sha256(Buffer.from(sourceUrl));
  const temporary = path.join(runtimeRoot, `asset-${process.pid}-${randomUUID()}.tmp`);
  let response;
  for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
    try {
      response = await fetch(sourceUrl, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
      if (response.ok) break;
      if (response.status !== 429 && response.status < 500) throw new SafeRequestError(response.status, `asset_http_${response.status}`);
      if (attempt === retryAttempts) throw new SafeRequestError(response.status, `asset_http_${response.status}`);
      await wait(retryBaseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 250));
    } catch (error) {
      if (error instanceof SafeRequestError && error.status && error.status < 500 && error.status !== 429) throw error;
      if (attempt === retryAttempts) {
        if (error instanceof SafeRequestError) throw error;
        throw new SafeRequestError(null, error?.name === "TimeoutError" ? "asset_timeout" : "asset_network_error");
      }
      await wait(retryBaseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 250));
    }
  }
  if (!response?.body) throw new SafeRequestError(null, "asset_empty_body");

  await mkdir(path.dirname(temporary), { recursive: true, mode: 0o700 });
  const hash = createHash("sha256");
  let bytes = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      bytes += chunk.length;
      callback(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(temporary, { flags: "wx", mode: 0o600 }));
    const digest = hash.digest("hex");
    const extension = contentExtension(response.headers.get("content-type"), sourceUrl);
    const relativePath = path.posix.join("assets", "sha256", digest.slice(0, 2), `${digest}${extension}`);
    const absolutePath = resolveInside(rawRoot, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
    try {
      await access(absolutePath);
      await unlink(temporary);
    } catch {
      await rename(temporary, absolutePath);
    }
    const parsed = new URL(sourceUrl);
    assets.push({
      key: `asset:${sourceHash}`,
      source_url_sha256: sourceHash,
      source_host: parsed.hostname,
      source_path: parsed.pathname,
      path: relativePath,
      sha256: digest,
      bytes,
      content_type: response.headers.get("content-type")?.split(";")[0] ?? null,
    });
  } catch (error) {
    try { await unlink(temporary); } catch {}
    throw error;
  }
}

function attachBlobs(record, blobs) {
  const present = blobs.filter(Boolean).sort((a, b) => a.format.localeCompare(b.format));
  if (present.length > 0) record.blobs = present;
}

console.log("Yuque sync: reading account and enumerating personal books");
const user = await fetchApi("/user");
await storeJson("user", user.id, user, {
  source_updated_at: user.updated_at ?? null,
  visibility: "private",
});

const reposResult = await listByOffset(
  `/users/${encodeURIComponent(user.login)}/repos`,
  repoPageSize,
  "repo-list-page",
  user.id,
);
const repos = reposResult.items;
const documents = [];

for (const repoSummary of repos) {
  const repoId = repoSummary.id;
  let repo = repoSummary;
  try {
    repo = await fetchApi(`/repos/${repoId}`);
  } catch (error) {
    recordError("repo", repoId, error);
  }
  await storeJson("repo", repoId, repo, {
    source_updated_at: repo.updated_at ?? null,
    visibility: visibilityOf(repo),
  });

  let toc = [];
  let tocComplete = !scope.include_toc;
  if (scope.include_toc) {
    try {
      toc = await fetchApi(`/repos/${repoId}/toc`);
      await storeJson("toc", repoId, toc, { visibility: visibilityOf(repo) });
      tocComplete = true;
    } catch (error) {
      recordError("toc", repoId, error);
    }
  }

  try {
    const docsResult = await listByOffset(
      `/repos/${repoId}/docs`,
      docPageSize,
      "doc-list-page",
      repoId,
    );
    for (const doc of docsResult.items) documents.push({ repo, summary: doc });
    const tocDocIds = new Set((Array.isArray(toc) ? toc : []).map((item) => item?.doc_id).filter(Boolean));
    bookCoverage.push({
      repo_id: String(repoId),
      declared_items: Number.isInteger(repo.items_count) ? repo.items_count : null,
      listed_docs: docsResult.items.length,
      toc_docs: tocDocIds.size,
      pagination_complete: docsResult.complete,
      toc_complete: tocComplete,
    });
  } catch (error) {
    recordError("doc-list", repoId, error);
    bookCoverage.push({
      repo_id: String(repoId),
      declared_items: Number.isInteger(repo.items_count) ? repo.items_count : null,
      listed_docs: 0,
      toc_docs: 0,
      pagination_complete: false,
      toc_complete: tocComplete,
    });
  }
}

console.log(`Yuque sync: ${repos.length} books and ${documents.length} documents enumerated`);

await mapLimit(documents, concurrency, async ({ repo, summary }) => {
  const docId = summary.id;
  if (scope.include_legacy_doc) {
    try {
      const doc = await fetchApi(`/repos/${repo.id}/docs/${docId}`);
      const record = await storeJson("doc-legacy", docId, doc, {
        repo_id: String(repo.id),
        source_updated_at: doc.content_updated_at ?? doc.updated_at ?? null,
        visibility: visibilityOf(doc, visibilityOf(repo)),
      });
      const blobs = await Promise.all([
        storeBlob("markdown", doc.body, ".md"),
        storeBlob("html", doc.body_html, ".html"),
        storeBlob("lake", doc.body_lake, ".lake"),
      ]);
      attachBlobs(record, blobs);
      collectTextResources(doc.body, docId);
      collectTextResources(doc.body_html, docId);
      collectTextResources(doc.body_lake, docId);
    } catch (error) {
      recordError("doc-legacy", docId, error);
    }
  }

  if (scope.include_ymd_doc) {
    try {
      const ymd = await fetchApi("/yfm/docs", { doc_id: docId });
      const record = await storeJson("doc-ymd", docId, ymd, {
        repo_id: String(repo.id),
        source_updated_at: ymd.updated_at ?? summary.updated_at ?? null,
        visibility: visibilityOf(summary, visibilityOf(repo)),
      });
      attachBlobs(record, [await storeBlob("ymd", ymd.yfm, ".md")]);
      collectTextResources(ymd.yfm, docId);
    } catch (error) {
      recordError("doc-ymd", docId, error);
    }
  }

  processedDocs += 1;
  if (processedDocs % 50 === 0 || processedDocs === documents.length) {
    console.log(`Yuque sync: documents ${processedDocs}/${documents.length}`);
  }
});

const noteSummaries = [];
let notesPaginationComplete = true;
for (const status of scope.note_statuses ?? [0, 9]) {
  try {
    const result = await listNotesByStatus(status);
    notesPaginationComplete &&= result.complete;
    noteSummaries.push(...result.items.map((note) => ({ status, note })));
  } catch (error) {
    recordError("note-list", status, error);
    notesPaginationComplete = false;
  }
}
const uniqueNotes = [...new Map(noteSummaries.map((item) => [item.note.id, item])).values()];

await mapLimit(uniqueNotes, concurrency, async ({ note }) => {
  try {
    const fullNote = await fetchApi(`/notes/${note.id}`);
    const record = await storeJson("note", note.id, fullNote, {
      source_updated_at: fullNote.updated_at ?? null,
      visibility: visibilityOf(fullNote),
      status: fullNote.status ?? null,
    });
    const blobs = await Promise.all([
      storeBlob("note-markdown", fullNote.content?.source, ".md"),
      storeBlob("note-html", fullNote.content?.html, ".html"),
    ]);
    attachBlobs(record, blobs);
    collectTextResources(fullNote.content?.source, `note-${note.id}`);
    collectTextResources(fullNote.content?.html, `note-${note.id}`);
  } catch (error) {
    recordError("note", note.id, error);
  }
  processedNotes += 1;
  if (processedNotes % 20 === 0 || processedNotes === uniqueNotes.length) {
    console.log(`Yuque sync: notes ${processedNotes}/${uniqueNotes.length}`);
  }
});

console.log(`Yuque sync: ${boardRefs.size} boards and ${assetUrls.size} linked assets discovered`);

await mapLimit([...boardRefs.values()], concurrency, async ({ docId, resourceId }) => {
  try {
    const board = await fetchApi("/yfm/boards", { doc_id: docId, src: resourceId });
    await storeJson("board", `${docId}:${sha256(Buffer.from(resourceId)).slice(0, 24)}`, board, {
      doc_id: String(docId),
      resource_id_sha256: sha256(Buffer.from(resourceId)),
      source_updated_at: board.updated_at ?? null,
      visibility: "private",
    });
  } catch (error) {
    recordError("board", `${docId}:${sha256(Buffer.from(resourceId)).slice(0, 24)}`, error);
  }
});

const mirrorAssets = Boolean(scope.mirror_assets) && !skipAssets;
if (mirrorAssets) {
  let processedAssets = 0;
  const urls = [...assetUrls].sort();
  await mapLimit(urls, Math.min(concurrency, 3), async (sourceUrl) => {
    try {
      await downloadAsset(sourceUrl);
    } catch (error) {
      recordError("asset", sha256(Buffer.from(sourceUrl)), error);
    }
    processedAssets += 1;
    if (processedAssets % 25 === 0 || processedAssets === urls.length) {
      console.log(`Yuque sync: assets ${processedAssets}/${urls.length}`);
    }
  });
}

objects.sort((a, b) => a.key.localeCompare(b.key) || a.sha256.localeCompare(b.sha256));
assets.sort((a, b) => a.key.localeCompare(b.key));
errors.sort((a, b) => `${a.kind}:${a.source_id}`.localeCompare(`${b.kind}:${b.source_id}`));
bookCoverage.sort((a, b) => a.repo_id.localeCompare(b.repo_id));

const countByKind = Object.fromEntries(
  [...new Set(objects.map((record) => record.kind))]
    .sort()
    .map((kind) => [kind, objects.filter((record) => record.kind === kind).length]),
);
const declaredDocuments = bookCoverage.reduce((sum, book) => sum + (book.declared_items ?? 0), 0);
const listedDocuments = bookCoverage.reduce((sum, book) => sum + book.listed_docs, 0);
const paginationComplete = reposResult.complete
  && notesPaginationComplete
  && bookCoverage.every((book) => book.pagination_complete && book.toc_complete);
const countConsistent = bookCoverage.every((book) => (
  book.declared_items === null || book.declared_items === book.listed_docs
));
const assetsComplete = !mirrorAssets || assets.length === assetUrls.size;
const coverage = {
  schema_version: "1.0.0",
  complete: paginationComplete && assetsComplete && errors.length === 0,
  scope: {
    personal_books: true,
    groups: false,
    note_statuses: [...(scope.note_statuses ?? [0, 9])].sort((a, b) => a - b),
    legacy_documents: Boolean(scope.include_legacy_doc),
    ymd_documents: Boolean(scope.include_ymd_doc),
    toc: Boolean(scope.include_toc),
    linked_assets: mirrorAssets,
  },
  counts: {
    books: repos.length,
    documents_declared: declaredDocuments,
    documents_listed: listedDocuments,
    notes_listed: uniqueNotes.length,
    boards_discovered: boardRefs.size,
    boards_saved: countByKind.board ?? 0,
    assets_discovered: assetUrls.size,
    assets_saved: assets.length,
    errors: errors.length,
    objects: objects.length,
  },
  object_counts: countByKind,
  pagination_complete: paginationComplete,
  declared_document_counts_match: countConsistent,
  linked_assets_complete: assetsComplete,
  books: bookCoverage,
  errors,
  known_limitations: [
    "comments are not exported by the configured public API surface",
    "document version history is not exported",
    "permissions, members, and collaboration settings are not exported",
    "groups and organization spaces are intentionally outside this personal-data scope"
  ],
};

const manifest = {
  schema_version: "1.0.0",
  source: "yuque",
  account: { id: String(user.id), login: user.login },
  config_sha256: sha256(canonicalBytes(config)),
  coverage,
  objects,
  assets,
};
const manifestBytes = canonicalBytes(manifest);
const manifestDigest = sha256(manifestBytes);
await writeAtomic(path.join(rawRoot, "manifest.json"), manifestBytes);
await writeAtomic(path.join(rawRoot, "coverage.json"), canonicalBytes(coverage));
await writeAtomic(path.join(rawRoot, "asset-index.json"), canonicalBytes(assets));

const finishedAt = new Date();
const report = {
  schema_version: "1.0.0",
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  request_count: requestCount,
  rate_limit_remaining: rateLimitRemaining,
  manifest_sha256: manifestDigest,
  complete: coverage.complete,
  counts: coverage.counts,
};
await writeAtomic(path.join(runtimeRoot, "latest-report.json"), canonicalBytes(report));

console.log(`Yuque sync: manifest ${manifestDigest}`);
console.log(`Yuque sync: complete=${coverage.complete}, errors=${errors.length}, requests=${requestCount}`);
if (!coverage.complete) process.exitCode = 1;
