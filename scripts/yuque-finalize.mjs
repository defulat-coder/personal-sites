import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const EXPECTED_REPOSITORIES = 15;
const ASSET_EXTENSION =
  /\.(?:avif|bmp|csv|doc|docx|gif|gz|heic|heif|ico|jpeg|jpg|json|m4a|mov|mp3|mp4|mpeg|ogg|pdf|png|ppt|pptx|rar|svg|tar|tif|tiff|txt|wav|webm|webp|xls|xlsx|xml|zip|7z)$/i;
const ASSET_PATH_MARKER =
  /(?:^|\/)(?:asset|assets|attachment|attachments|download|downloads|file|files|image|images|resource|resources|upload|uploads)(?:\/|$)/i;
const ASSET_QUERY_KEY =
  /^(?:attname|attachment|download|filename|response-content-disposition|x-oss-process)$/i;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.resolve(projectRoot, process.argv[2] ?? "config/yuque-sync.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const rawRoot = resolveInside(projectRoot, config.storage?.raw_root ?? "data/private/yuque/raw");
const runtimeRoot = resolveInside(projectRoot, config.storage?.runtime_root ?? "var/yuque-sync");
const startedAt = new Date();
const errors = [];
const warnings = [];
const objects = [];
const objectCounts = new Map();
const repoIds = new Set();
const repos = new Map();
const tocRepoIds = new Set();
const docPages = new Map();
const listedDocIds = new Set();
const legacyDocIds = new Set();
const ymdDocIds = new Set();
const notePages = new Map();
const listedNoteIds = new Set();
const fullNoteIds = new Set();
const boardRefs = new Map();
const savedBoards = new Set();
const discoveredAssetHashes = new Set();
const fileHashCache = new Map();

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function resolveInside(root, child) {
  const resolved = path.resolve(root, child);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Path escapes root: ${child}`);
  return resolved;
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort(compareText).map((key) => [key, sortValue(value[key])]));
  }
  return value;
}

function canonicalBytes(value) {
  return Buffer.from(`${JSON.stringify(sortValue(value), null, 2)}\n`, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function writeAtomic(target, bytes) {
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporary, bytes, { mode: 0o600 });
  await rename(temporary, target);
}

async function walkFiles(root) {
  const files = [];
  async function walk(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries.sort((a, b) => compareText(a.name, b.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  await walk(root);
  return files;
}

async function hashFile(file) {
  if (fileHashCache.has(file)) return fileHashCache.get(file);
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk);
    bytes += chunk.length;
  }
  const result = { sha256: hash.digest("hex"), bytes };
  fileHashCache.set(file, result);
  return result;
}

async function scanStoredFiles(relativeRoot, knownFiles = null) {
  const files = knownFiles ?? await walkFiles(path.join(rawRoot, relativeRoot));
  const records = [];
  for (const file of files) {
    const relative = path.relative(rawRoot, file).split(path.sep).join("/");
    const actual = await hashFile(file);
    const namedDigest = path.basename(file).match(/^([a-f0-9]{64})(?:\.|$)/i)?.[1]?.toLowerCase();
    if (!namedDigest || namedDigest !== actual.sha256) {
      addIssue(errors, "stored_file_sha_mismatch", { path: relative });
    }
    records.push({ path: relative, sha256: actual.sha256, bytes: actual.bytes });
  }
  return records.sort((left, right) => compareText(left.path, right.path));
}

function addIssue(target, code, detail = {}) {
  target.push({ code, ...detail });
}

function stringId(value) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function visibilityOf(value) {
  if (value?.public === 1 || value?.public === true) return "public";
  if (value?.public === 0 || value?.public === false) return "private";
  return undefined;
}

function decodeHtmlEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#38;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function trimCandidate(value) {
  let candidate = decodeHtmlEntities(value.trim());
  if (candidate.startsWith("<") && candidate.endsWith(">")) candidate = candidate.slice(1, -1);
  candidate = candidate.replace(/[.,;:!?]+$/u, "");
  while (candidate.endsWith(")")) {
    const opens = (candidate.match(/\(/g) ?? []).length;
    const closes = (candidate.match(/\)/g) ?? []).length;
    if (closes <= opens) break;
    candidate = candidate.slice(0, -1);
  }
  return candidate;
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (isPrivateIpv4(host)) return true;
  if (!host.includes(":")) return false;
  return (
    host === "::" ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    /^fe[89ab]/i.test(host) ||
    host.startsWith("::ffff:127.") ||
    host.startsWith("::ffff:10.") ||
    host.startsWith("::ffff:192.168.")
  );
}

function parseHttpUrl(value) {
  let url;
  try {
    const candidate = trimCandidate(value);
    url = candidate.startsWith("//")
      ? new URL(`https:${candidate}`)
      : candidate.startsWith("/")
        ? new URL(candidate, "https://www.yuque.com")
        : new URL(candidate);
  } catch {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
  if (isPrivateHost(url.hostname)) return null;
  url.hash = "";
  return url;
}

function looksLikeAsset(url) {
  if (ASSET_EXTENSION.test(url.pathname) || ASSET_PATH_MARKER.test(url.pathname)) return true;
  if (
    url.hostname === "cdn.nlark.com" ||
    url.hostname.endsWith(".alicdn.com") ||
    url.hostname.endsWith(".alipayobjects.com")
  ) {
    return true;
  }
  for (const key of url.searchParams.keys()) if (ASSET_QUERY_KEY.test(key)) return true;
  return false;
}

function addAssetCandidate(value, forceAsset = false) {
  const url = parseHttpUrl(value);
  if (!url || (!forceAsset && !looksLikeAsset(url))) return;
  discoveredAssetHashes.add(sha256(url.href));
}

function collectResources(text, key, contextId) {
  if (typeof text !== "string" || text.length === 0) return;
  const directAssetKey = /^(?:attachment|attachment_url|cover|download_url|file_url|image|image_url|src)$/i.test(key);
  if (directAssetKey) addAssetCandidate(text, true);

  const markdownImage = /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/giu;
  for (const match of text.matchAll(markdownImage)) addAssetCandidate(match[1] ?? match[2], true);

  const markdownLink = /(?<!!)\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/giu;
  for (const match of text.matchAll(markdownLink)) addAssetCandidate(match[1] ?? match[2]);

  const htmlAttribute = /\b(src|href|data-src|data-url|data-download-url)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'<>`]+))/giu;
  for (const match of text.matchAll(htmlAttribute)) {
    const attribute = match[1].toLowerCase();
    addAssetCandidate(match[2] ?? match[3] ?? match[4], attribute !== "href" && attribute !== "data-url");
  }

  const cssUrl = /\burl\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)'";]+))\s*\)/giu;
  for (const match of text.matchAll(cssUrl)) addAssetCandidate(match[1] ?? match[2] ?? match[3], true);

  const bareUrl = /https?:\/\/[^\s<>"'`\\]+/giu;
  for (const match of text.matchAll(bareUrl)) addAssetCandidate(match[0]);

  for (const match of text.matchAll(/board:\/\/([a-zA-Z0-9._~%:+/-]+)/g)) {
    const resourceId = match[1].replace(/[.,;:!?]+$/, "");
    const sourceId = `${contextId}_${sha256(Buffer.from(resourceId)).slice(0, 24)}`;
    boardRefs.set(sourceId, { context_id: String(contextId), resource_id_sha256: sha256(Buffer.from(resourceId)) });
  }
}

function collectPayloadResources(value, contextId) {
  const stack = [{ key: "", value }];
  while (stack.length > 0) {
    const { key, value: current } = stack.pop();
    if (typeof current === "string") collectResources(current, key, contextId);
    else if (Array.isArray(current)) {
      for (const item of current) stack.push({ key, value: item });
    } else if (current && typeof current === "object") {
      for (const [childKey, childValue] of Object.entries(current)) stack.push({ key: childKey, value: childValue });
    }
  }
}

function pageMap(container, key) {
  if (!container.has(key)) container.set(key, new Map());
  return container.get(key);
}

async function expectedBlob(format, content, extension) {
  if (typeof content !== "string" || content.length === 0) return null;
  const bytes = Buffer.from(content, "utf8");
  const digest = sha256(bytes);
  const relative = path.posix.join("blobs", format, digest.slice(0, 2), `${digest}${extension}`);
  const absolute = resolveInside(rawRoot, relative);
  try {
    const actual = await hashFile(absolute);
    if (actual.sha256 !== digest) addIssue(errors, "blob_sha_mismatch", { path: relative });
    return { format, path: relative, sha256: actual.sha256, bytes: actual.bytes };
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeAtomic(absolute, bytes);
      return { format, path: relative, sha256: digest, bytes: bytes.length };
    }
    addIssue(errors, "blob_unreadable", { format, sha256: digest, reason: error.code ?? "unreadable" });
    return null;
  }
}

const allStoredObjectFiles = await walkFiles(path.join(rawRoot, "objects"));
const allObjectFiles = allStoredObjectFiles.filter((file) => file.endsWith(".json"));
const objectGroups = new Map();
for (const file of allObjectFiles) {
  const objectPathParts = path.relative(rawRoot, file).split(path.sep);
  const [prefix, kind, sourceId] = objectPathParts;
  if (objectPathParts.length !== 4 || prefix !== "objects" || !kind || !sourceId) {
    addIssue(errors, "invalid_object_path", { path: path.relative(rawRoot, file).split(path.sep).join("/") });
    continue;
  }
  const key = `${kind}:${sourceId}`;
  if (!objectGroups.has(key)) objectGroups.set(key, []);
  objectGroups.get(key).push(file);
}
const objectFiles = [];
for (const [key, versions] of [...objectGroups].sort(([left], [right]) => compareText(left, right))) {
  versions.sort(compareText);
  if (versions.length > 1) addIssue(warnings, "multiple_object_versions", { key, versions: versions.length });
  objectFiles.push(versions.at(-1));
}
for (const file of objectFiles) {
  const relative = path.relative(rawRoot, file).split(path.sep).join("/");
  const parts = relative.split("/");
  const kind = parts[1];
  const sourceId = parts[2];
  const bytes = await readFile(file);
  const digest = sha256(bytes);
  fileHashCache.set(file, { sha256: digest, bytes: bytes.length });
  if (path.basename(file, ".json") !== digest) addIssue(errors, "object_sha_mismatch", { path: relative });
  let payload;
  try {
    payload = JSON.parse(bytes.toString("utf8"));
  } catch {
    addIssue(errors, "invalid_object_json", { path: relative });
    continue;
  }

  const record = { key: `${kind}:${sourceId}`, kind, source_id: sourceId, path: relative, sha256: digest, bytes: bytes.length };
  let resourceContext = null;
  const visibility = visibilityOf(payload);
  if (visibility) record.visibility = visibility;
  objectCounts.set(kind, (objectCounts.get(kind) ?? 0) + 1);

  if (kind === "user") record.source_updated_at = payload.updated_at ?? null;
  if (kind === "repo") {
    const id = stringId(payload.id ?? sourceId);
    if (id) repos.set(id, payload);
    record.source_updated_at = payload.updated_at ?? null;
  }
  if (kind === "repo-list-page") {
    if (!Array.isArray(payload)) addIssue(errors, "invalid_repo_list_page_payload", { source_id: sourceId });
    else for (const repo of payload) if (stringId(repo?.id)) repoIds.add(String(repo.id));
  }
  if (kind === "toc") tocRepoIds.add(String(sourceId));
  if (kind === "doc-list-page") {
    const match = sourceId.match(/^(\d+)_(\d+)$/);
    if (!Array.isArray(payload)) addIssue(errors, "invalid_doc_page_payload", { source_id: sourceId });
    else if (match) {
      const [, repoId, offsetText] = match;
      const ids = payload.map((doc) => stringId(doc?.id)).filter(Boolean);
      for (const id of ids) listedDocIds.add(id);
      pageMap(docPages, repoId).set(Number(offsetText), { length: payload.length, ids });
    } else addIssue(errors, "invalid_doc_page_id", { source_id: sourceId });
  }
  if (kind === "doc-legacy") {
    const validPayload = payload
      && typeof payload === "object"
      && !Array.isArray(payload)
      && stringId(payload.id)
      && [payload.body, payload.body_html, payload.body_lake, payload.body_draft].some((value) => typeof value === "string");
    if (!validPayload) {
      record.valid_payload = false;
      addIssue(warnings, "invalid_doc_legacy_payload_ignored", { source_id_sha256: sha256(Buffer.from(sourceId)) });
    } else {
      record.valid_payload = true;
      const id = stringId(payload.id);
      legacyDocIds.add(id);
      resourceContext = id;
      record.repo_id = stringId(payload.book_id ?? payload.book?.id);
      record.source_updated_at = payload.content_updated_at ?? payload.updated_at ?? null;
      record.blobs = (await Promise.all([
        expectedBlob("markdown", payload.body, ".md"),
        expectedBlob("html", payload.body_html, ".html"),
        expectedBlob("lake", payload.body_lake, ".lake"),
      ])).filter(Boolean).sort((a, b) => compareText(a.format, b.format));
    }
  }
  if (kind === "doc-ymd") {
    const id = stringId(payload.doc_id ?? sourceId);
    if (id) ymdDocIds.add(id);
    resourceContext = id;
    record.source_updated_at = payload.updated_at ?? null;
    record.blobs = [await expectedBlob("ymd", payload.yfm, ".md")].filter(Boolean);
  }
  if (kind === "note-list-page") {
    const match = sourceId.match(/^(-?\d+)_(\d+)$/);
    if (match) {
      const [, status, pageText] = match;
      if (["0", "9"].includes(status)) {
        const validPayload = payload
          && typeof payload === "object"
          && !Array.isArray(payload)
          && typeof payload.has_more === "boolean"
          && (payload.pin_notes === undefined || Array.isArray(payload.pin_notes))
          && (payload.notes === undefined || Array.isArray(payload.notes));
        if (!validPayload) addIssue(errors, "invalid_note_page_payload", { source_id: sourceId });
        else {
          const notes = [...(payload.pin_notes ?? []), ...(payload.notes ?? [])];
          const ids = notes.map((note) => stringId(note?.id)).filter(Boolean);
          for (const id of ids) listedNoteIds.add(id);
          pageMap(notePages, status).set(Number(pageText), { has_more: payload.has_more, ids });
        }
      }
    } else addIssue(errors, "invalid_note_page_id", { source_id: sourceId });
  }
  if (kind === "note") {
    const id = stringId(payload.id ?? sourceId);
    if (id) fullNoteIds.add(id);
    resourceContext = `note-${id}`;
    record.status = payload.status ?? null;
    record.source_updated_at = payload.updated_at ?? null;
    record.blobs = (await Promise.all([
      expectedBlob("note-markdown", payload.content?.source, ".md"),
      expectedBlob("note-html", payload.content?.html, ".html"),
    ])).filter(Boolean).sort((a, b) => compareText(a.format, b.format));
  }
  if (kind === "board") savedBoards.add(sourceId);
  if (resourceContext) collectPayloadResources(payload, resourceContext);
  if (record.blobs?.length === 0) delete record.blobs;
  objects.push(record);
}

const objectFileEntries = await scanStoredFiles("objects", allStoredObjectFiles);
const blobFiles = await scanStoredFiles("blobs");

for (const id of listedDocIds) {
  if (!legacyDocIds.has(id)) addIssue(errors, "legacy_document_missing", { doc_id: id });
  if (config.scope?.include_ymd_doc && !ymdDocIds.has(id)) addIssue(warnings, "ymd_document_unavailable", { doc_id: id });
}
for (const id of listedNoteIds) if (!fullNoteIds.has(id)) addIssue(errors, "full_note_missing", { note_id: id });
for (const [sourceId, reference] of boardRefs) if (!savedBoards.has(sourceId)) addIssue(errors, "board_missing", reference);

const docPageSize = Math.min(100, Number(config.api?.doc_page_size) || 100);
for (const repoId of repoIds) {
  if (!repos.has(repoId)) addIssue(errors, "repository_missing", { repo_id: repoId });
  if (config.scope?.include_toc && !tocRepoIds.has(repoId)) addIssue(errors, "toc_missing", { repo_id: repoId });
  const pages = docPages.get(repoId);
  const offsets = [...(pages?.keys() ?? [])].sort((a, b) => a - b);
  const paginationComplete = offsets.length > 0
    && offsets[0] === 0
    && offsets.every((offset, index) => (
      offset === index * docPageSize
      && (index === offsets.length - 1
        ? pages.get(offset).length < docPageSize
        : pages.get(offset).length === docPageSize)
    ));
  if (!paginationComplete) addIssue(errors, "document_pagination_incomplete", { repo_id: repoId });
}

for (const status of ["0", "9"]) {
  const pages = notePages.get(status);
  const offsets = [...(pages?.keys() ?? [])].sort((a, b) => a - b);
  const complete = offsets.length > 0
    && offsets[0] === 0
    && offsets.every((offset, index) => (
      offset === index * 20
      && pages.get(offset).has_more === (index < offsets.length - 1)
    ));
  if (!complete) addIssue(errors, "note_pagination_incomplete", { status: Number(status) });
}

const savedRepoIds = new Set(repos.keys());
for (const repoId of savedRepoIds) {
  if (!repoIds.has(repoId)) addIssue(errors, "unlisted_repository_object", { repo_id: repoId });
}
if (repoIds.size !== EXPECTED_REPOSITORIES || savedRepoIds.size !== EXPECTED_REPOSITORIES) {
  addIssue(errors, "repository_count_mismatch", {
    expected: EXPECTED_REPOSITORIES,
    listed: repoIds.size,
    saved: savedRepoIds.size,
  });
}

const bookCoverage = [...repoIds].sort(compareText).map((repoId) => {
  const pages = docPages.get(repoId) ?? new Map();
  const docIds = new Set([...pages.values()].flatMap((page) => page.ids));
  const declared = Number.isInteger(repos.get(repoId)?.items_count) ? repos.get(repoId).items_count : null;
  if (declared !== null && declared !== docIds.size) {
    addIssue(warnings, "declared_document_count_differs", { repo_id: repoId, declared_items: declared, listed_docs: docIds.size });
  }
  return { repo_id: repoId, declared_items: declared, listed_docs: docIds.size };
});

let assetIndex = null;
try {
  assetIndex = JSON.parse(await readFile(path.join(rawRoot, "asset-index.json"), "utf8"));
} catch (error) {
  addIssue(errors, "asset_index_missing_or_invalid", { reason: error.code ?? "invalid_json" });
}
let indexedEntries = [];
if (Array.isArray(assetIndex)) indexedEntries = assetIndex;
else if (Array.isArray(assetIndex?.entries)) {
  indexedEntries = assetIndex.entries;
  if (assetIndex.schema_version !== "1.0.0") addIssue(errors, "unsupported_asset_index_schema");
}
else if (Array.isArray(assetIndex?.assets)) indexedEntries = assetIndex.assets;
else if (assetIndex !== null) addIssue(errors, "invalid_asset_index_shape");
const assets = [];
const successfulAssetHashes = new Set();
const indexedAssetHashes = new Set();
for (const entry of indexedEntries) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    addIssue(errors, "invalid_asset_index_entry");
    continue;
  }
  const sourceHash = entry.source_url_sha256 ?? entry.url_sha256 ?? (entry.source_url ? sha256(Buffer.from(entry.source_url)) : null);
  if (sourceHash) discoveredAssetHashes.add(sourceHash);
  if (!/^[a-f0-9]{64}$/.test(sourceHash ?? "")) {
    addIssue(errors, "invalid_asset_source_sha", { source_url_sha256: sourceHash ?? null });
    continue;
  }
  if (indexedAssetHashes.has(sourceHash)) {
    addIssue(errors, "duplicate_asset_index_entry", { source_url_sha256: sourceHash });
    continue;
  }
  indexedAssetHashes.add(sourceHash);
  const success = entry.status === "success" && entry.success !== false && entry.path && entry.sha256;
  if (!success || !sourceHash) continue;
  try {
    const absolute = resolveInside(rawRoot, entry.path);
    const actual = await hashFile(absolute);
    if (entry.path !== `assets/sha256/${entry.sha256}` || entry.sha256 !== actual.sha256) {
      addIssue(errors, "asset_sha_mismatch", { source_url_sha256: sourceHash });
    }
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes !== actual.bytes) {
      addIssue(errors, "asset_size_mismatch", { source_url_sha256: sourceHash });
    }
    successfulAssetHashes.add(sourceHash);
    assets.push({
      key: `asset:${sourceHash}`,
      source_url_sha256: sourceHash,
      source_host: entry.source_host ?? entry.host ?? null,
      source_path: entry.source_path ?? null,
      path: entry.path,
      sha256: actual.sha256,
      bytes: actual.bytes,
      content_type: entry.content_type ?? null,
    });
  } catch (error) {
    addIssue(errors, "asset_missing", { source_url_sha256: sourceHash, reason: error.code ?? "unreadable" });
  }
}
for (const sourceHash of [...discoveredAssetHashes].sort(compareText)) {
  if (!successfulAssetHashes.has(sourceHash)) addIssue(errors, "asset_not_successful", { source_url_sha256: sourceHash });
}

const assetFiles = await scanStoredFiles("assets");

objects.sort((a, b) => compareText(a.key, b.key) || compareText(a.sha256, b.sha256));
assets.sort((a, b) => compareText(a.key, b.key) || compareText(a.sha256, b.sha256));
errors.sort((a, b) => compareText(JSON.stringify(a), JSON.stringify(b)));
warnings.sort((a, b) => compareText(JSON.stringify(a), JSON.stringify(b)));

const paginationComplete = !errors.some((error) => error.code.includes("pagination"));
const coverage = {
  schema_version: "1.0.0",
  complete: errors.length === 0,
  scope: {
    personal_books: true,
    groups: false,
    note_statuses: [0, 9],
    legacy_documents: true,
    ymd_documents: Boolean(config.scope?.include_ymd_doc),
    toc: Boolean(config.scope?.include_toc),
    linked_assets: Boolean(config.scope?.mirror_assets),
  },
  counts: {
    books: repoIds.size,
    documents_declared: bookCoverage.reduce((sum, book) => sum + (book.declared_items ?? 0), 0),
    documents_listed: listedDocIds.size,
    legacy_documents: legacyDocIds.size,
    ymd_documents: ymdDocIds.size,
    notes_listed: listedNoteIds.size,
    notes_saved: fullNoteIds.size,
    boards_discovered: boardRefs.size,
    boards_saved: [...boardRefs.keys()].filter((key) => savedBoards.has(key)).length,
    assets_discovered: discoveredAssetHashes.size,
    assets_saved: assets.length,
    errors: errors.length,
    warnings: warnings.length,
    objects: objects.length,
    object_files: objectFileEntries.length,
    blob_files: blobFiles.length,
    asset_files: assetFiles.length,
  },
  object_counts: Object.fromEntries([...objectCounts].sort(([a], [b]) => compareText(a, b))),
  pagination_complete: paginationComplete,
  declared_document_counts_match: warnings.every((warning) => warning.code !== "declared_document_count_differs"),
  declared_document_count_warnings: warnings.filter((warning) => warning.code === "declared_document_count_differs"),
  books: bookCoverage,
  errors,
  warnings,
  known_limitations: [
    "comments are not exported",
    "document version history is not exported",
    "permissions and collaboration settings are not exported",
    "groups and organization spaces are outside this personal-data scope",
  ],
};

const users = objects.filter((record) => record.kind === "user");
let account = { id: null, login: null };
if (users.length > 0) {
  const payload = JSON.parse(await readFile(resolveInside(rawRoot, users[0].path), "utf8"));
  account = { id: stringId(payload.id), login: payload.login ?? null };
}
const manifest = {
  schema_version: "1.0.0",
  source: "yuque",
  account,
  config_sha256: sha256(canonicalBytes(config)),
  coverage,
  objects,
  assets,
  object_files: objectFileEntries,
  blob_files: blobFiles,
  asset_files: assetFiles,
};
const manifestBytes = canonicalBytes(manifest);
const manifestDigest = sha256(manifestBytes);
await writeAtomic(path.join(rawRoot, "coverage.json"), canonicalBytes(coverage));
await writeAtomic(path.join(rawRoot, "manifest.json"), manifestBytes);

const finishedAt = new Date();
await writeAtomic(path.join(runtimeRoot, "latest-finalize-report.json"), canonicalBytes({
  schema_version: "1.0.0",
  started_at: startedAt.toISOString(),
  finished_at: finishedAt.toISOString(),
  duration_ms: finishedAt.getTime() - startedAt.getTime(),
  manifest_sha256: manifestDigest,
  complete: coverage.complete,
  counts: coverage.counts,
}));

console.log(`Yuque finalize: manifest ${manifestDigest}`);
console.log(`Yuque finalize: complete=${coverage.complete}, errors=${errors.length}, warnings=${warnings.length}`);
if (!coverage.complete) process.exitCode = 1;
