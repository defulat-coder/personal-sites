import { createHash } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  publicCategorySchema,
  publicContentManifestSchema,
  publicContentProjectionSchema,
  publicContentSelectionSchema,
} from "./lib/public-content-schema.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const selectionPath = path.join(projectRoot, "config/public-content.json");
const publicRoot = path.join(projectRoot, "knowledge/public");
const okfBundleRoot = path.join(projectRoot, "knowledge/private/personal");
const secretPatterns = [
  { name: "private-key", pattern: /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/gu },
  { name: "github-token", pattern: /gh[pousr]_[A-Za-z0-9]{30,}/gu },
  { name: "openai-key", pattern: /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/gu },
  { name: "aws-access-key", pattern: /AKIA[0-9A-Z]{16}/gu },
  { name: "bearer-token", pattern: /Bearer\s+[A-Za-z0-9._~+/-]{24,}={0,2}/gu },
];
const privacyPatterns = [
  { name: "email", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu },
  { name: "mainland-phone", pattern: /(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/gu },
  { name: "mainland-id", pattern: /(?<!\d)\d{17}[0-9X](?!\d)/giu },
];
const confidentialityPatterns = [
  { name: "internal-only", pattern: /仅供内部|内部确认|内部会议|会议纪要/gu },
  { name: "confidential", pattern: /机密|保密/gu },
];
const forbiddenReferencePatterns = [
  { name: "private-data-directory", pattern: /data[\\/]private/giu },
  { name: "private-knowledge-directory", pattern: /knowledge[\\/]private/giu },
  { name: "environment-file", pattern: /(?:^|[\\/'\"`])\.env(?:\.|[\\/'\"`]|$)/gm },
  { name: "token-variable", pattern: /(?:YUQUE|OPENAI|ANTHROPIC)_(?:ACCESS_)?(?:TOKEN|API_KEY)/gu },
];

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function collectOkfIndexFiles(directory = okfBundleRoot) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectOkfIndexFiles(entryPath)));
    } else if (entry.isFile() && entry.name === "index.md") {
      files.push(entryPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

async function resolveSource(source) {
  if (
    source.kind !== "okf-index-catalog" ||
    source.locator !== "complete-okf-indexes"
  ) {
    throw new Error(`Unsupported OKF index source: ${source.id}`);
  }

  const files = await collectOkfIndexFiles();
  const indexes = await Promise.all(
    files.map(async (file) => ({
      relative: path.relative(okfBundleRoot, file).split(path.sep).join("/"),
      raw: await readFile(file, "utf8"),
    })),
  );
  return {
    indexFileCount: indexes.length,
    raw: indexes
      .map(({ relative, raw }) => `<!-- OKF INDEX ${relative} -->\n${raw.trim()}\n`)
      .join("\n"),
  };
}

function normalizeForEvidence(source) {
  return source
    .replaceAll("\r\n", "\n")
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gu, "$1 $2")
    .replace(/<[^>]+>/gu, "")
    .replace(/[`*_>#]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function findPatternMatches(value, patterns) {
  const findings = [];
  for (const { name, pattern } of patterns) {
    pattern.lastIndex = 0;
    const occurrences = value.match(pattern)?.length ?? 0;
    if (occurrences > 0) {
      findings.push({ name, occurrences });
    }
  }
  return findings;
}

export function scanPublicValue(value) {
  const serialized = canonicalJson(value);
  return {
    secretFindings: findPatternMatches(serialized, secretPatterns),
    privacyFindings: findPatternMatches(serialized, privacyPatterns),
    confidentialityFindings: findPatternMatches(
      serialized,
      confidentialityPatterns,
    ),
    privateReferenceFindings: findPatternMatches(
      serialized,
      forbiddenReferencePatterns,
    ),
  };
}

async function loadSelection() {
  return publicContentSelectionSchema.parse(
    JSON.parse(await readFile(selectionPath, "utf8")),
  );
}

async function loadSources(selection) {
  const sources = new Map();
  for (const source of selection.sources) {
    const { indexFileCount, raw } = await resolveSource(source);
    sources.set(source.id, {
      ...source,
      indexFileCount,
      raw,
      normalized: normalizeForEvidence(raw),
      sha256: sha256(raw),
    });
  }
  return sources;
}

function buildClaims(record, evidenceSha256) {
  const fields = ["title", "summary", "url"];
  return fields
    .filter((field) => record.output[field] !== undefined)
    .map((field) => ({
      field,
      value: record.output[field],
      evidenceSha256,
    }));
}

function buildCategoryCounts(records) {
  return Object.fromEntries(
    publicCategorySchema.options.map((category) => {
      const selected = records.filter((record) => record.category === category);
      const published = selected.filter((record) => record.status === "published");
      return [
        category,
        {
          selected: selected.length,
          published: published.length,
          excluded: selected.length - published.length,
        },
      ];
    }),
  );
}

export async function buildPublicContentModel() {
  const selection = await loadSelection();
  const sources = await loadSources(selection);
  const items = [];
  const manifestRecords = [];
  const unsupportedClaims = [];

  for (const record of selection.records) {
    const source = sources.get(record.sourceId);
    if (!source) {
      throw new Error(`Record ${record.id} references a missing source`);
    }

    if (record.status === "excluded") {
      manifestRecords.push({
        id: record.id,
        category: record.category,
        sourceId: record.sourceId,
        sourceSha256: source.sha256,
        status: "excluded",
        outputIds: [],
        exclusionReason: record.exclusionReason,
      });
      continue;
    }

    record.evidenceFragments.forEach((fragment, index) => {
      if (!source.raw.includes(fragment) && !source.normalized.includes(fragment)) {
        unsupportedClaims.push({ recordId: record.id, evidenceIndex: index });
      }
    });
    const evidenceSha256 = sha256(record.evidenceFragments.join("\n"));
    items.push({
      id: record.id,
      category: record.category,
      sortOrder: record.sortOrder,
      ...record.output,
      claims: buildClaims(record, evidenceSha256),
      provenance: [
        {
          sourceId: record.sourceId,
          sourceSha256: source.sha256,
          evidenceSha256,
        },
      ],
    });
    manifestRecords.push({
      id: record.id,
      category: record.category,
      sourceId: record.sourceId,
      sourceSha256: source.sha256,
      status: "published",
      outputIds: [record.id],
      evidenceSha256,
    });
  }

  if (unsupportedClaims.length > 0) {
    throw new Error(
      `Unsupported public claim evidence: ${JSON.stringify(unsupportedClaims)}`,
    );
  }

  items.sort(
    (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
  );
  const projectionBase = {
    schemaVersion: "2.0.0",
    generatorVersion: "2.0.0",
    items,
  };
  const contentHash = sha256(canonicalJson(projectionBase));
  const projection = publicContentProjectionSchema.parse({
    ...projectionBase,
    contentHash,
  });
  const scan = scanPublicValue(projection);
  const scanCount = Object.values(scan).reduce(
    (total, findings) => total + findings.length,
    0,
  );
  if (scanCount > 0) {
    throw new Error(`Public projection safety scan failed: ${JSON.stringify(scan)}`);
  }

  const sourceManifest = selection.sources.map((source) => {
    const related = manifestRecords.filter((record) => record.sourceId === source.id);
    if (related.length === 0) {
      throw new Error(`Selected source ${source.id} has no accounting record`);
    }
    const statuses = new Set(related.map((record) => record.status));
    return {
      id: source.id,
      kind: "index-source",
      sha256: sources.get(source.id).sha256,
      indexFileCount: sources.get(source.id).indexFileCount,
      disposition:
        statuses.size > 1
          ? "mixed"
          : statuses.has("published")
            ? "published"
            : "excluded-only",
    };
  });
  const excludedRecords = manifestRecords.filter(
    (record) => record.status === "excluded",
  );
  const excludedByReason = Object.fromEntries(
    [...new Set(excludedRecords.map((record) => record.exclusionReason))]
      .sort()
      .map((reason) => [
        reason,
        excludedRecords.filter((record) => record.exclusionReason === reason).length,
      ]),
  );
  const inputHash = sha256(
    canonicalJson({
      selection,
      sources: sourceManifest.map(({ id, sha256: sourceSha256 }) => ({
        id,
        sha256: sourceSha256,
      })),
    }),
  );
  const manifest = publicContentManifestSchema.parse({
    schemaVersion: "2.0.0",
    generatorVersion: "2.0.0",
    generationId: sha256(`${inputHash}:${contentHash}`),
    inputHash,
    projectionHash: contentHash,
    sourceCount: sourceManifest.length,
    selectedCount: manifestRecords.length,
    publishedCount: items.length,
    excludedCount: excludedRecords.length,
    excludedByReason,
    silentDropCount: selection.records.length - manifestRecords.length,
    categoryCounts: buildCategoryCounts(manifestRecords),
    findings: {
      secretFindings: 0,
      privacyFindings: 0,
      confidentialityFindings: 0,
      unsupportedClaimFindings: unsupportedClaims.length,
    },
    sources: sourceManifest,
    records: manifestRecords,
  });

  return { manifest, projection };
}

function quoteYaml(value) {
  return JSON.stringify(value);
}

function renderItem(item) {
  const provenance = item.provenance[0];
  const body = [
    "---",
    "type: PublicContent",
    `id: ${quoteYaml(item.id)}`,
    `category: ${quoteYaml(item.category)}`,
    "visibility: public",
    "review_status: approved",
    `source_id: ${quoteYaml(provenance.sourceId)}`,
    `source_sha256: ${quoteYaml(provenance.sourceSha256)}`,
    `evidence_sha256: ${quoteYaml(provenance.evidenceSha256)}`,
    "---",
    "",
    `# ${item.title}`,
    "",
    item.summary,
  ];
  if (item.url) {
    body.push("", `[访问公开来源](${item.url})`);
  }
  return `${body.join("\n")}\n`;
}

function renderIndex(projection, manifest) {
  const labels = {
    identity: "身份",
    project: "项目",
    knowledge: "知识主题",
    practice: "工程实践",
  };
  const lines = [
    "---",
    "type: Documentation",
    "title: Public Portfolio Knowledge",
    "visibility: public",
    "review_status: approved",
    `content_sha256: ${quoteYaml(projection.contentHash)}`,
    "---",
    "",
    "# Public Portfolio Knowledge",
    "",
    "仅包含完成来源核验、脱敏与公开审批的个人网站内容。",
  ];
  for (const category of publicCategorySchema.options) {
    lines.push("", `## ${labels[category]}`, "");
    for (const item of projection.items.filter((entry) => entry.category === category)) {
      lines.push(`- [${item.title}](items/${category}/${item.id}.md) — ${item.summary}`);
    }
  }
  lines.push(
    "",
    `生成 ID：\`${manifest.generationId}\``,
    `；发布 ${manifest.publishedCount} 条，排除 ${manifest.excludedCount} 条，静默丢弃 ${manifest.silentDropCount} 条。`,
    "",
  );
  return lines.join("\n");
}

async function writeAtomic(file, contents) {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, contents, "utf8");
  await rename(temporary, file);
}

export async function writePublicContent(model) {
  await mkdir(publicRoot, { recursive: true });
  const stagingItems = path.join(publicRoot, `.items-${process.pid}`);
  await rm(stagingItems, { force: true, recursive: true });
  await mkdir(stagingItems, { recursive: true });

  for (const item of model.projection.items) {
    const categoryDirectory = path.join(stagingItems, item.category);
    await mkdir(categoryDirectory, { recursive: true });
    await writeFile(
      path.join(categoryDirectory, `${item.id}.md`),
      renderItem(item),
      "utf8",
    );
  }

  const itemsRoot = path.join(publicRoot, "items");
  await rm(itemsRoot, { force: true, recursive: true });
  await rename(stagingItems, itemsRoot);
  await writeAtomic(
    path.join(publicRoot, "content.json"),
    canonicalJson(model.projection),
  );
  await writeAtomic(
    path.join(publicRoot, "content-manifest.json"),
    canonicalJson(model.manifest),
  );
  await writeAtomic(
    path.join(publicRoot, "index.md"),
    renderIndex(model.projection, model.manifest),
  );
}

async function main() {
  const model = await buildPublicContentModel();
  await writePublicContent(model);
  console.log(
    `public content built: published=${model.manifest.publishedCount}, excluded=${model.manifest.excludedCount}, silent_drops=${model.manifest.silentDropCount}, generation=${model.manifest.generationId.slice(0, 12)}`,
  );
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
