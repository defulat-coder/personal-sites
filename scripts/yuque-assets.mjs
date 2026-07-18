#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  link,
  lstat,
  mkdir,
  open,
  opendir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const RAW_ROOT = path.join(PROJECT_ROOT, "data/private/yuque/raw");
const OBJECTS_ROOT = path.join(RAW_ROOT, "objects");
const ASSET_ROOT = path.join(RAW_ROOT, "assets/sha256");
const INDEX_PATH = path.join(RAW_ROOT, "asset-index.json");
const CHECKPOINT_PATH = path.join(PROJECT_ROOT, "var/yuque-sync/asset-checkpoint.json");
const SOURCE_KINDS = ["doc-legacy", "doc-ymd", "note"];

const CONCURRENCY = 16;
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const CHECKPOINT_BATCH_SIZE = 50;
const MAX_REDIRECTS = 5;

const ASSET_EXTENSION =
  /\.(?:avif|bmp|csv|doc|docx|gif|gz|heic|heif|ico|jpeg|jpg|json|m4a|mov|mp3|mp4|mpeg|ogg|pdf|png|ppt|pptx|rar|svg|tar|tif|tiff|txt|wav|webm|webp|xls|xlsx|xml|zip|7z)$/i;
const ASSET_PATH_MARKER =
  /(?:^|\/)(?:asset|assets|attachment|attachments|download|downloads|file|files|image|images|resource|resources|upload|uploads)(?:\/|$)/i;
const ASSET_QUERY_KEY =
  /^(?:attname|attachment|download|filename|response-content-disposition|x-oss-process)$/i;

class DownloadError extends Error {
  constructor(code, { retryable = false, status = null } = {}) {
    super(code);
    this.name = "DownloadError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function assertInside(root, target) {
  if (!isInside(root, target)) throw new Error("path-outside-root");
  return target;
}

async function atomicWriteJson(targetPath, value) {
  assertInside(PROJECT_ROOT, targetPath);
  await mkdir(path.dirname(targetPath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  const body = `${JSON.stringify(value, null, 2)}\n`;
  try {
    await writeFile(temporaryPath, body, { encoding: "utf8", mode: 0o600, flag: "wx" });
    const handle = await open(temporaryPath, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, targetPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

async function walkJsonFiles(root) {
  const files = [];
  const directories = [root];
  let skippedSymlinks = 0;

  while (directories.length > 0) {
    const directory = directories.pop();
    let stream;
    try {
      stream = await opendir(directory);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }

    for await (const entry of stream) {
      const absolutePath = assertInside(OBJECTS_ROOT, path.join(directory, entry.name));
      if (entry.isSymbolicLink()) {
        skippedSymlinks += 1;
      } else if (entry.isDirectory()) {
        directories.push(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push(absolutePath);
      }
    }
  }

  files.sort();
  return { files, skippedSymlinks };
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
  if (host.includes(":")) {
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
  return false;
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
  if (ASSET_EXTENSION.test(url.pathname)) return true;
  if (ASSET_PATH_MARKER.test(url.pathname)) return true;
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

function addCandidate(value, discovered, forceAsset = false) {
  const url = parseHttpUrl(value);
  if (!url || (!forceAsset && !looksLikeAsset(url))) return;
  const retrievalUrl = url.href;
  const sourceUrlSha256 = sha256(retrievalUrl);
  if (discovered.has(sourceUrlSha256)) return;
  discovered.set(sourceUrlSha256, {
    retrievalUrl,
    source_url_sha256: sourceUrlSha256,
    host: url.hostname.toLowerCase(),
    source_path: url.pathname || "/",
  });
}

function extractUrlsFromText(text, key, discovered) {
  const directAssetKey = /^(?:attachment|attachment_url|cover|download_url|file_url|image|image_url|src)$/i.test(key);
  if (directAssetKey) addCandidate(text, discovered, true);

  const markdownImage = /!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/giu;
  for (const match of text.matchAll(markdownImage)) addCandidate(match[1] ?? match[2], discovered, true);

  const markdownLink = /(?<!!)\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/giu;
  for (const match of text.matchAll(markdownLink)) addCandidate(match[1] ?? match[2], discovered, false);

  const htmlAttribute = /\b(src|href|data-src|data-url|data-download-url)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'<>`]+))/giu;
  for (const match of text.matchAll(htmlAttribute)) {
    const attribute = match[1].toLowerCase();
    const forceAsset = attribute !== "href" && attribute !== "data-url";
    addCandidate(match[2] ?? match[3] ?? match[4], discovered, forceAsset);
  }

  const cssUrl = /\burl\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)'";]+))\s*\)/giu;
  for (const match of text.matchAll(cssUrl)) addCandidate(match[1] ?? match[2] ?? match[3], discovered, true);

  const bareUrl = /https?:\/\/[^\s<>"'`\\]+/giu;
  for (const match of text.matchAll(bareUrl)) addCandidate(match[0], discovered, false);
}

function extractAssetUrls(payload, discovered) {
  const stack = [{ key: "", value: payload }];
  while (stack.length > 0) {
    const { key, value } = stack.pop();
    if (typeof value === "string") {
      extractUrlsFromText(value, key, discovered);
    } else if (Array.isArray(value)) {
      for (const item of value) stack.push({ key, value: item });
    } else if (value && typeof value === "object") {
      for (const [childKey, childValue] of Object.entries(value)) stack.push({ key: childKey, value: childValue });
    }
  }
}

async function loadExistingIndex() {
  try {
    const parsed = JSON.parse(await readFile(INDEX_PATH, "utf8"));
    if (parsed?.schema_version !== "1.0.0" || !Array.isArray(parsed.entries)) return new Map();
    return new Map(
      parsed.entries
        .filter((entry) => typeof entry?.source_url_sha256 === "string")
        .map((entry) => [entry.source_url_sha256, entry]),
    );
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return new Map();
    throw error;
  }
}

function successfulEntryIsUsable(entry) {
  if (
    entry?.status !== "success" ||
    !/^[a-f0-9]{64}$/.test(entry.sha256 ?? "") ||
    entry.path !== `assets/sha256/${entry.sha256}` ||
    !Number.isSafeInteger(entry.bytes) ||
    entry.bytes < 0
  ) {
    return false;
  }
  const absolutePath = path.join(RAW_ROOT, entry.path);
  if (!isInside(RAW_ROOT, absolutePath)) return false;
  return lstat(absolutePath)
    .then((details) => details.isFile() && !details.isSymbolicLink() && details.size === entry.bytes)
    .catch(() => false);
}

function normalizeContentType(value) {
  const contentType = value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(contentType) ? contentType : null;
}

function isRedirect(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function cancelBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // The body may already be closed; nothing remains to persist.
  }
}

async function storeResponseBody(response, signal) {
  await mkdir(ASSET_ROOT, { recursive: true, mode: 0o700 });
  const temporaryPath = path.join(ASSET_ROOT, `.partial-${process.pid}-${randomUUID()}`);
  const digest = createHash("sha256");
  let bytes = 0;
  const meter = new Transform({
    transform(chunk, _encoding, callback) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      digest.update(buffer);
      bytes += buffer.byteLength;
      callback(null, buffer);
    },
  });

  try {
    if (response.body) {
      await pipeline(
        Readable.fromWeb(response.body),
        meter,
        createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 }),
        { signal },
      );
    } else {
      await writeFile(temporaryPath, Buffer.alloc(0), { flag: "wx", mode: 0o600 });
    }

    const contentSha256 = digest.digest("hex");
    const relativePath = `assets/sha256/${contentSha256}`;
    const targetPath = assertInside(RAW_ROOT, path.join(RAW_ROOT, relativePath));
    try {
      await link(temporaryPath, targetPath);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const existing = await stat(targetPath);
      if (!existing.isFile() || existing.size !== bytes) throw new DownloadError("STORE_COLLISION");
    }
    await unlink(temporaryPath);
    return { bytes, contentSha256, relativePath };
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

async function downloadOnce(retrievalUrl) {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let currentUrl = retrievalUrl;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const parsed = parseHttpUrl(currentUrl);
    if (!parsed) throw new DownloadError("UNSAFE_URL");

    let response;
    try {
      response = await fetch(parsed, {
        method: "GET",
        redirect: "manual",
        signal,
        headers: {
          Accept: "*/*",
          "User-Agent": "personal-sites-yuque-asset-sync/1.0",
        },
      });
    } catch (error) {
      const timeout = error?.name === "AbortError" || error?.name === "TimeoutError";
      throw new DownloadError(timeout ? "TIMEOUT" : "NETWORK", { retryable: true });
    }

    if (isRedirect(response.status)) {
      const location = response.headers.get("location");
      await cancelBody(response);
      if (!location || redirects === MAX_REDIRECTS) throw new DownloadError("REDIRECT");
      try {
        currentUrl = new URL(location, parsed).href;
      } catch {
        throw new DownloadError("REDIRECT");
      }
      continue;
    }

    if (!response.ok) {
      await cancelBody(response);
      throw new DownloadError("HTTP", {
        retryable: isRetryableStatus(response.status),
        status: response.status,
      });
    }

    try {
      const stored = await storeResponseBody(response, signal);
      return {
        ...stored,
        contentType: normalizeContentType(response.headers.get("content-type")),
      };
    } catch (error) {
      if (error instanceof DownloadError) throw error;
      const timeout = error?.name === "AbortError" || error?.name === "TimeoutError";
      if (timeout) throw new DownloadError("TIMEOUT", { retryable: true });
      if (["ENOSPC", "EACCES", "EROFS", "EMFILE", "ENFILE"].includes(error?.code)) throw error;
      throw new DownloadError("BODY", { retryable: true });
    }
  }

  throw new DownloadError("REDIRECT");
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function downloadAsset(asset) {
  let lastError = new DownloadError("UNKNOWN");
  let attempts = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    attempts = attempt + 1;
    try {
      const result = await downloadOnce(asset.retrievalUrl);
      return {
        source_url_sha256: asset.source_url_sha256,
        host: asset.host,
        source_path: asset.source_path,
        content_type: result.contentType,
        bytes: result.bytes,
        sha256: result.contentSha256,
        path: result.relativePath,
        status: "success",
        attempts,
      };
    } catch (error) {
      if (!(error instanceof DownloadError)) throw error;
      lastError = error;
      if (!error.retryable || attempt === MAX_RETRIES) break;
      await wait(250 * 2 ** attempt);
    }
  }

  return {
    source_url_sha256: asset.source_url_sha256,
    host: asset.host,
    source_path: asset.source_path,
    content_type: null,
    bytes: null,
    sha256: null,
    path: null,
    status: "failed",
    attempts,
    error_code: lastError.code,
    http_status: lastError.status,
  };
}

async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        results[index] = await worker(items[index]);
      }
    }),
  );
  return results;
}

function sortedEntries(entriesByHash) {
  return [...entriesByHash.values()].sort((left, right) =>
    left.source_url_sha256.localeCompare(right.source_url_sha256),
  );
}

function sanitizedSuccessfulEntry(asset, previous) {
  return {
    source_url_sha256: asset.source_url_sha256,
    host: asset.host,
    source_path: asset.source_path,
    content_type: normalizeContentType(previous.content_type),
    bytes: previous.bytes,
    sha256: previous.sha256,
    path: previous.path,
    status: "success",
    attempts: Number.isSafeInteger(previous.attempts) && previous.attempts > 0 ? previous.attempts : 1,
  };
}

function completionPhase(entriesByHash, metrics) {
  if (metrics.pendingCount > 0) return "running";
  if (metrics.scanFailureCount > 0) return "partial";
  for (const entry of entriesByHash.values()) if (entry.status === "failed") return "partial";
  return "complete";
}

async function persist(entriesByHash, metrics, phase) {
  const entries = sortedEntries(entriesByHash);
  const successCount = entries.filter((entry) => entry.status === "success").length;
  const failureCount = entries.filter((entry) => entry.status === "failed").length;
  await atomicWriteJson(INDEX_PATH, {
    schema_version: "1.0.0",
    entries,
  });
  await atomicWriteJson(CHECKPOINT_PATH, {
    schema_version: "1.0.0",
    phase,
    updated_at: new Date().toISOString(),
    source_file_count: metrics.sourceFileCount,
    scan_failure_count: metrics.scanFailureCount,
    discovered_url_count: metrics.discoveredUrlCount,
    processed_this_run: metrics.processedThisRun,
    skipped_success_count: metrics.skippedSuccessCount,
    pending_count: metrics.pendingCount,
    success_count: successCount,
    failure_count: failureCount,
  });
  return { successCount, failureCount };
}

async function main() {
  const nodeMajor = Number.parseInt(process.versions.node.split(".", 1)[0], 10);
  if (nodeMajor < 20 || process.argv.slice(2).length > 0) throw new Error("invalid-runtime");

  const discovered = new Map();
  let sourceFileCount = 0;
  let scanFailureCount = 0;

  for (const kind of SOURCE_KINDS) {
    const { files, skippedSymlinks } = await walkJsonFiles(path.join(OBJECTS_ROOT, kind));
    scanFailureCount += skippedSymlinks;
    for (const file of files) {
      sourceFileCount += 1;
      try {
        extractAssetUrls(JSON.parse(await readFile(file, "utf8")), discovered);
      } catch {
        scanFailureCount += 1;
      }
    }
  }

  const existing = await loadExistingIndex();
  const entriesByHash = new Map();
  const pending = [];
  let skippedSuccessCount = 0;

  for (const asset of [...discovered.values()].sort((left, right) =>
    left.source_url_sha256.localeCompare(right.source_url_sha256),
  )) {
    const previous = existing.get(asset.source_url_sha256);
    if (await successfulEntryIsUsable(previous)) {
      entriesByHash.set(asset.source_url_sha256, sanitizedSuccessfulEntry(asset, previous));
      skippedSuccessCount += 1;
    } else {
      pending.push(asset);
    }
  }

  const metrics = {
    sourceFileCount,
    scanFailureCount,
    discoveredUrlCount: discovered.size,
    processedThisRun: 0,
    skippedSuccessCount,
    pendingCount: pending.length,
  };

  process.stdout.write(
    `[yuque-assets] files=${sourceFileCount} discovered=${discovered.size} skipped=${skippedSuccessCount} pending=${pending.length}\n`,
  );

  for (let offset = 0; offset < pending.length; offset += CHECKPOINT_BATCH_SIZE) {
    const batch = pending.slice(offset, offset + CHECKPOINT_BATCH_SIZE);
    const results = await mapConcurrent(batch, CONCURRENCY, downloadAsset);
    for (const result of results) entriesByHash.set(result.source_url_sha256, result);
    metrics.processedThisRun += results.length;
    metrics.pendingCount = pending.length - metrics.processedThisRun;
    const counts = await persist(entriesByHash, metrics, completionPhase(entriesByHash, metrics));
    process.stdout.write(
      `[yuque-assets] processed=${metrics.processedThisRun} success=${counts.successCount} failed=${counts.failureCount} pending=${metrics.pendingCount}\n`,
    );
  }

  const counts = await persist(entriesByHash, metrics, completionPhase(entriesByHash, metrics));
  process.stdout.write(
    `[yuque-assets] files=${sourceFileCount} discovered=${discovered.size} success=${counts.successCount} failed=${counts.failureCount} scan_failed=${scanFailureCount}\n`,
  );
  if (counts.failureCount > 0 || scanFailureCount > 0) process.exitCode = 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH;
if (isMain) {
  main().catch(() => {
    process.stderr.write("[yuque-assets] fatal=1\n");
    process.exitCode = 1;
  });
}

export {
  addCandidate,
  downloadAsset,
  extractAssetUrls,
  isPrivateHost,
  looksLikeAsset,
  main,
  parseHttpUrl,
  sha256,
};
