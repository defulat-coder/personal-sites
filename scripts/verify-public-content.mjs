import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  buildPublicContentModel,
  canonicalJson,
  scanPublicValue,
  sha256,
} from "./build-public-content.mjs";
import {
  publicContentManifestSchema,
  publicContentProjectionSchema,
} from "./lib/public-content-schema.mjs";
import {
  createRunId,
  repositoryRoot,
  writeJsonAtomic,
} from "./lib/site-verification.mjs";

const publicRoot = path.join(repositoryRoot, "knowledge/public");

async function collectPublicFiles(directory = publicRoot) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectPublicFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function verifyClaimCoverage(projection) {
  for (const item of projection.items) {
    const expected = ["title", "summary", ...(item.url ? ["url"] : [])];
    assert(
      item.claims.length === expected.length,
      `Claim count mismatch for ${item.id}`,
    );
    for (const field of expected) {
      const claim = item.claims.find((entry) => entry.field === field);
      assert(claim, `Missing ${field} claim for ${item.id}`);
      assert(claim.value === item[field], `Claim value mismatch for ${item.id}`);
      assert(
        item.provenance.some(
          (entry) =>
            entry.evidenceSha256 === claim.evidenceSha256 &&
            entry.fields.includes(field) &&
            entry.indexPaths.length > 0,
        ),
        `Claim evidence mismatch for ${item.id}`,
      );
    }
  }
}

function verifyAccounting(projection, manifest) {
  assert(
    manifest.selectedCount === manifest.publishedCount + manifest.excludedCount,
    "Selected count does not equal published + excluded",
  );
  assert(manifest.silentDropCount === 0, "Manifest contains silent drops");
  assert(
    manifest.publishedCount === projection.items.length,
    "Published count does not match projection",
  );
  assert(
    manifest.records.length === manifest.selectedCount,
    "Manifest record count does not match selected count",
  );
  const publishedIds = new Set(projection.items.map((item) => item.id));
  const accountedPublishedIds = new Set(
    manifest.records.flatMap((record) => record.outputIds),
  );
  assert(
    publishedIds.size === accountedPublishedIds.size &&
      [...publishedIds].every((id) => accountedPublishedIds.has(id)),
    "Published output accounting is incomplete",
  );
  for (const record of manifest.records) {
    if (record.status === "published") {
      assert(record.outputIds.length === 1, `Published record ${record.id} is ambiguous`);
      assert(record.evidenceSha256, `Published record ${record.id} lacks evidence`);
      assert(record.indexPaths?.length > 0, `Published record ${record.id} lacks index paths`);
      assert(!record.exclusionReason, `Published record ${record.id} has an exclusion reason`);
    } else {
      assert(record.outputIds.length === 0, `Excluded record ${record.id} has output`);
      assert(record.exclusionReason, `Excluded record ${record.id} lacks a reason`);
    }
  }
  const excludedReasonCount = Object.values(manifest.excludedByReason).reduce(
    (total, value) => total + value,
    0,
  );
  assert(
    excludedReasonCount === manifest.excludedCount,
    "Exclusion reason counts do not match excluded count",
  );
}

function verifyProjectionHash(projection, manifest) {
  const { contentHash, ...projectionBase } = projection;
  const recomputed = sha256(canonicalJson(projectionBase));
  assert(contentHash === recomputed, "Projection content hash is stale");
  assert(manifest.projectionHash === recomputed, "Manifest projection hash is stale");
}

function verifyMarkdownItems(files, projection) {
  const markdownFiles = files
    .filter((file) => file.includes(`${path.sep}items${path.sep}`))
    .map((file) => path.relative(publicRoot, file).split(path.sep).join("/"));
  const expectedFiles = projection.items
    .map((item) => `items/${item.category}/${item.id}.md`)
    .sort();
  assert(
    canonicalJson(markdownFiles) === canonicalJson(expectedFiles),
    "Generated Markdown item set is stale",
  );
}

export async function verifyPublicContent() {
  const projectionPath = path.join(publicRoot, "content.json");
  const manifestPath = path.join(publicRoot, "content-manifest.json");
  const projection = publicContentProjectionSchema.parse(
    JSON.parse(await readFile(projectionPath, "utf8")),
  );
  const manifest = publicContentManifestSchema.parse(
    JSON.parse(await readFile(manifestPath, "utf8")),
  );
  const expected = await buildPublicContentModel();

  assert(
    canonicalJson(projection) === canonicalJson(expected.projection),
    "Public projection is not deterministic or is stale",
  );
  assert(
    canonicalJson(manifest) === canonicalJson(expected.manifest),
    "Public manifest is not deterministic or is stale",
  );
  verifyProjectionHash(projection, manifest);
  verifyAccounting(projection, manifest);
  verifyClaimCoverage(projection);

  const files = await collectPublicFiles();
  verifyMarkdownItems(files, projection);
  const publicFileContents = await Promise.all(
    files.map(async (file) => ({
      file: path.relative(publicRoot, file).split(path.sep).join("/"),
      contents: await readFile(file, "utf8"),
    })),
  );
  const safetyScan = scanPublicValue(publicFileContents);
  const findingCounts = Object.fromEntries(
    Object.entries(safetyScan).map(([key, findings]) => [key, findings.length]),
  );
  assert(
    Object.values(findingCounts).every((count) => count === 0),
    `Public file safety scan failed: ${JSON.stringify(findingCounts)}`,
  );
  assert(
    Object.values(manifest.findings).every((count) => count === 0),
    "Manifest reports a safety or provenance finding",
  );

  return {
    result: "pass",
    generationId: manifest.generationId,
    inputHash: manifest.inputHash,
    projectionHash: manifest.projectionHash,
    filesVerified: files.length,
    sourceCount: manifest.sourceCount,
    selectedCount: manifest.selectedCount,
    publishedCount: manifest.publishedCount,
    excludedCount: manifest.excludedCount,
    excludedByReason: manifest.excludedByReason,
    silentDropCount: manifest.silentDropCount,
    categoryCounts: manifest.categoryCounts,
    findings: manifest.findings,
    privateSourceReferences: findingCounts.privateReferenceFindings,
  };
}

async function main() {
  const runId = createRunId();
  try {
    const result = await verifyPublicContent();
    await writeJsonAtomic("public-content.json", { ...result, runId });
    console.log(
      `public content verified: published=${result.publishedCount}, excluded=${result.excludedCount}, silent_drops=${result.silentDropCount}, findings=0, generation=${result.generationId.slice(0, 12)}`,
    );
  } catch (error) {
    await writeJsonAtomic("public-content.json", {
      result: "fail",
      runId,
      error: error.message,
    });
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
