function stripSourceFrontmatter(value) {
  if (!value.startsWith("---\n")) return value;
  const match = value.match(/^---\n([\s\S]*?)\n---(?:\n|$)/u);
  if (!match || !/^\s*[A-Za-z_][A-Za-z0-9_.-]*\s*:/mu.test(match[1])) return value;
  return value.slice(match[0].length);
}

export function cleanMarkdownBody(value) {
  const normalized = String(value ?? "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replace(/[\u200B-\u200D\uFEFF]/gu, "");
  return stripSourceFrontmatter(normalized)
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function titleKey(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\p{P}\p{S}\s]+/gu, "")
    .trim();
}

function decodeTitleEntities(value) {
  return String(value)
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'");
}

function stripTitleMarkup(value) {
  return decodeTitleEntities(String(value ?? ""))
    .replace(/[\u0000-\u001f\u007f\u200B-\u200D\uFEFF]+/gu, " ")
    .replace(/<!doctype\b[^>]*>/giu, " ")
    .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/giu, " ")
    .replace(/<[^>]*>/gu, " ")
    .replace(/\s*\{\s*id=(?:"[^"]*"|'[^']*')\s*\}\s*$/iu, " ");
}

function cleanTitle(value, limit = 100) {
  const title = stripTitleMarkup(value)
    .replace(/[*_`~\[\]<>]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (!title) return "";
  return title.length > limit ? `${title.slice(0, limit - 1)}…` : title;
}

function usefulDerivedTitle(value) {
  const raw = String(value ?? "").trim();
  if (!raw || /^[\[{]/u.test(raw) || /^<board-card\b/iu.test(raw)) return "";
  if (/["']?(?:format|type|version)["']?\s*:/iu.test(raw)) return "";
  const title = cleanTitle(raw);
  if (!title || /^(?:!doctype|meta\s+name|board-card\b)/iu.test(title)) return "";
  const semantic = title.replace(/[\p{P}\p{S}\s]+/gu, "");
  if (!semantic || /^\d+$/u.test(semantic)) return "";
  return title;
}

function plainBodyText(value) {
  return decodeTitleEntities(String(value ?? ""))
    .replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f\u200B-\u200D\uFEFF]+/gu, " ")
    .replace(/<!doctype\b[^>]*>/giu, " ")
    .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/giu, " ")
    .replace(/<\/(?:h[1-6]|p|div|li|tr|section|article)>/giu, "\n")
    .replace(/<br\s*\/?\s*>/giu, "\n")
    .replace(/<[^>]*>/gu, " ");
}

function withoutFencedCode(value) {
  const output = [];
  let fence = null;
  for (const line of String(value ?? "").split("\n")) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/u)?.[1];
    if (!fence && marker) {
      fence = { character: marker[0], length: marker.length };
      continue;
    }
    if (fence) {
      const trimmed = line.trim();
      const closingLength = [...trimmed].findIndex((character) => character !== fence.character);
      const runLength = closingLength < 0 ? trimmed.length : closingLength;
      if (runLength >= fence.length && trimmed.slice(runLength).trim() === "") fence = null;
      continue;
    }
    output.push(line);
  }
  return output.join("\n");
}

export function deriveConceptTitle({ sourceTitle, body, fallback, placeholderTitles = [] }) {
  const source = cleanTitle(sourceTitle);
  const placeholders = new Set(placeholderTitles.map(titleKey));
  if (source && !placeholders.has(titleKey(source))) return { title: source, derived: false };

  const cleanedBody = withoutFencedCode(cleanMarkdownBody(body));
  const markdownHeading = cleanedBody.match(/^\s{0,3}#{1,6}\s+(.+)$/mu)?.[1];
  const htmlHeading = cleanedBody.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/iu)?.[1];
  const firstLine = plainBodyText(cleanedBody)
    .split("\n")
    .map((line) => line.replace(/^\s*(?:>|[-+*]|\d+[.)])\s*/u, "").trim())
    .find((line) => Boolean(line) && !/^(?:```|~~~)/u.test(line));
  const derived = [markdownHeading, htmlHeading, firstLine]
    .map(usefulDerivedTitle)
    .find(Boolean) ?? "";
  return { title: derived || cleanTitle(fallback), derived: Boolean(derived) };
}

export function removeRedundantLeadingHeading(body, title) {
  const cleaned = cleanMarkdownBody(body);
  const lines = cleaned.split("\n");
  const heading = lines[0]?.match(/^\s{0,3}#{1,6}\s+(.+)$/u)?.[1];
  if (!heading || titleKey(cleanTitle(heading)) !== titleKey(title)) return cleaned;
  return lines.slice(1).join("\n").trimStart();
}

export function normalizeExactContent(value) {
  return cleanMarkdownBody(value).normalize("NFKC");
}

export function normalizeContentForFingerprint(value) {
  return cleanMarkdownBody(value)
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/```[^\n]*\n/gu, "\n")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, " $1 ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/https?:\/\/\S+/gu, " url ")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/giu, " ")
    .replace(/[\p{P}\p{S}\s]+/gu, "")
    .trim();
}

export function hasEmbeddedResource(body, source = {}) {
  if (source.has_image || source.has_attachment || source.has_bookmark) return true;
  const value = String(body ?? "");
  return /!\[[^\]]*\]\([^)]*\)|<(?:img|video|audio|iframe|unknown-card|board-card|attachment-card|file-card|localfile-card)\b|<card\b[^>]*\bname=["']?(?:bookmarklink|image|attachment|file|video)\b/iu.test(value);
}

export function classifyContent({
  kind,
  body,
  hasMedia = false,
  sourceStatus,
  shortFormChars = 100,
}) {
  const cleanedBody = cleanMarkdownBody(body);
  const normalizedText = normalizeContentForFingerprint(cleanedBody);
  let quality = "substantive";
  if (Number(sourceStatus) === 9) quality = "archived";
  else if (!cleanedBody) quality = "empty";
  else if (!normalizedText && hasMedia) quality = "media-only";
  else if (!normalizedText) quality = "textless";
  else if (kind === "note" && normalizedText.length < shortFormChars) quality = "short-form";
  return { cleanedBody, normalizedText, normalizedLength: normalizedText.length, quality };
}

function canonicalRank(item) {
  const created = Date.parse(item.createdAt ?? "");
  return [
    Number(Number(item.sourceStatus) === 9),
    Number(item.kind !== "document"),
    Number(item.sourceFormat !== "ymd"),
    Number(Boolean(item.titleDerived)),
    Number.isFinite(created) ? created : Number.MAX_SAFE_INTEGER,
    String(item.conceptId),
  ];
}

function compareRank(left, right) {
  const leftRank = canonicalRank(left);
  const rightRank = canonicalRank(right);
  for (let index = 0; index < leftRank.length; index += 1) {
    if (leftRank[index] < rightRank[index]) return -1;
    if (leftRank[index] > rightRank[index]) return 1;
  }
  return 0;
}

export function buildExactDuplicatePlan(items, { minChars = 20 } = {}) {
  const byFingerprint = new Map();
  for (const item of items) {
    if (!item.fingerprint || item.normalizedLength < minChars) continue;
    if (!byFingerprint.has(item.fingerprint)) byFingerprint.set(item.fingerprint, []);
    byFingerprint.get(item.fingerprint).push(item);
  }

  const groups = [];
  const assignments = new Map();
  for (const [fingerprint, members] of [...byFingerprint.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (members.length < 2) continue;
    const ranked = [...members].sort(compareRank);
    const canonical = ranked[0];
    const memberIds = ranked.map((item) => item.conceptId);
    const group = {
      id: `exact-${fingerprint.slice(0, 16)}`,
      fingerprint,
      canonicalId: canonical.conceptId,
      memberIds,
    };
    groups.push(group);
    assignments.set(canonical.conceptId, {
      status: "canonical",
      duplicateGroup: group.id,
      duplicateOf: null,
      duplicates: memberIds.filter((conceptId) => conceptId !== canonical.conceptId),
    });
    for (const conceptId of memberIds.slice(1)) {
      assignments.set(conceptId, {
        status: "duplicate",
        duplicateGroup: group.id,
        duplicateOf: canonical.conceptId,
        duplicates: [],
      });
    }
  }
  return { groups, assignments };
}

export function buildTitleCollisionGroups(items) {
  const byTitle = new Map();
  for (const item of items) {
    const normalizedTitle = titleKey(item.title);
    if (!normalizedTitle) continue;
    if (!byTitle.has(normalizedTitle)) byTitle.set(normalizedTitle, []);
    byTitle.get(normalizedTitle).push(item);
  }

  const groups = [];
  for (const [normalizedTitle, members] of byTitle) {
    if (members.length < 2) continue;
    const distinctBodies = new Set(members.map((item) => item.fingerprint ?? `missing:${item.conceptId}`));
    if (distinctBodies.size < 2) continue;
    groups.push({
      normalizedTitle,
      memberIds: members.map((item) => item.conceptId).sort((left, right) => left.localeCompare(right)),
    });
  }
  return groups.sort((left, right) => left.normalizedTitle.localeCompare(right.normalizedTitle));
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function shingleSet(value, size) {
  if (!value) return new Set();
  if (value.length <= size) return new Set([value]);
  const output = new Set();
  for (let index = 0; index <= value.length - size; index += 1) output.add(value.slice(index, index + size));
  return output;
}

function bottomHashes(value, { shingleSize, fingerprintSize }) {
  if (value.length < shingleSize) return [];
  const step = Math.max(1, Math.floor((value.length - shingleSize + 1) / 10000));
  const hashes = new Set();
  for (let index = 0; index <= value.length - shingleSize; index += step) {
    hashes.add(fnv1a32(value.slice(index, index + shingleSize)));
  }
  return [...hashes].sort((left, right) => left - right).slice(0, fingerprintSize);
}

function jaccard(left, right) {
  if (left.size === 0 || right.size === 0) return 0;
  const smaller = left.size <= right.size ? left : right;
  const larger = smaller === left ? right : left;
  let intersection = 0;
  for (const item of smaller) if (larger.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

export function findNearDuplicatePairs(items, {
  minChars = 100,
  threshold = 0.9,
  shingleSize = 5,
  fingerprintSize = 64,
  minimumSharedFingerprints = 3,
  maxBucketSize = 40,
} = {}) {
  const eligible = items
    .filter((item) => item.normalizedText?.length >= minChars)
    .sort((left, right) => left.conceptId.localeCompare(right.conceptId));
  const buckets = new Map();
  for (let index = 0; index < eligible.length; index += 1) {
    for (const hash of bottomHashes(eligible[index].normalizedText, { shingleSize, fingerprintSize })) {
      if (!buckets.has(hash)) buckets.set(hash, []);
      buckets.get(hash).push(index);
    }
  }

  const candidateCounts = new Map();
  for (const bucket of buckets.values()) {
    if (bucket.length < 2 || bucket.length > maxBucketSize) continue;
    for (let left = 0; left < bucket.length; left += 1) {
      for (let right = left + 1; right < bucket.length; right += 1) {
        const key = `${bucket[left]}:${bucket[right]}`;
        candidateCounts.set(key, (candidateCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const shingleCache = new Map();
  const pairs = [];
  for (const [key, sharedFingerprints] of candidateCounts) {
    if (sharedFingerprints < minimumSharedFingerprints) continue;
    const [leftIndex, rightIndex] = key.split(":").map(Number);
    const left = eligible[leftIndex];
    const right = eligible[rightIndex];
    if (left.fingerprint && left.fingerprint === right.fingerprint) continue;
    const lengthRatio = Math.min(left.normalizedText.length, right.normalizedText.length)
      / Math.max(left.normalizedText.length, right.normalizedText.length);
    if (lengthRatio < 0.5) continue;
    if (!shingleCache.has(leftIndex)) shingleCache.set(leftIndex, shingleSet(left.normalizedText, shingleSize));
    if (!shingleCache.has(rightIndex)) shingleCache.set(rightIndex, shingleSet(right.normalizedText, shingleSize));
    const shorter = left.normalizedText.length <= right.normalizedText.length ? left.normalizedText : right.normalizedText;
    const longer = shorter === left.normalizedText ? right.normalizedText : left.normalizedText;
    const containment = longer.includes(shorter) ? shorter.length / longer.length : 0;
    const similarity = Math.max(jaccard(shingleCache.get(leftIndex), shingleCache.get(rightIndex)), containment);
    if (similarity < threshold) continue;
    pairs.push({
      conceptIds: [left.conceptId, right.conceptId],
      similarity: Number(similarity.toFixed(6)),
      sharedFingerprints,
    });
  }
  return pairs.sort((left, right) => right.similarity - left.similarity
    || left.conceptIds[0].localeCompare(right.conceptIds[0])
    || left.conceptIds[1].localeCompare(right.conceptIds[1]));
}
