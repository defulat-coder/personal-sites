import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  createRunId,
  evidenceDirectory,
  repositoryRoot,
  writeJsonAtomic,
} from "./lib/site-verification.mjs";
import {
  publicContentManifestSchema,
  publicContentProjectionSchema,
} from "./lib/public-content-schema.mjs";

const applicationRoots = ["app", "components", "lib", "public"];
const publicContentRoots = ["knowledge/public"];
const buildRoots = [".next/server/app", ".next/static"];
const allowedExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".mjs",
  ".md",
  ".ts",
  ".tsx",
]);
const forbiddenReferences = [
  { name: "private-data-directory", pattern: /data[\\/]private/giu },
  { name: "private-knowledge-directory", pattern: /knowledge[\\/]private/giu },
  { name: "environment-file", pattern: /(?:^|[\\/'\"`])\.env(?:\.|[\\/'\"`]|$)/gm },
  { name: "yuque-token-variable", pattern: /YUQUE_(?:ACCESS_)?TOKEN/gu },
];
const secretPatterns = [
  { name: "private-key", pattern: /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/gu },
  { name: "github-token", pattern: /gh[pousr]_[A-Za-z0-9]{30,}/gu },
  { name: "openai-key", pattern: /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/gu },
  { name: "aws-access-key", pattern: /AKIA[0-9A-Z]{16}/gu },
  { name: "bearer-token", pattern: /Bearer\s+[A-Za-z0-9._~+/-]{24,}={0,2}/gu },
];

async function collectFiles(relativeRoot) {
  const absoluteRoot = path.join(repositoryRoot, relativeRoot);
  const files = [];

  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "cache") {
          await visit(entryPath);
        }
        continue;
      }
      if (entry.isFile() && allowedExtensions.has(path.extname(entry.name))) {
        files.push(entryPath);
      }
    }
  }

  await visit(absoluteRoot);
  return files;
}

function findMatches(fileName, contents, patterns) {
  const findings = [];
  for (const { name, pattern } of patterns) {
    pattern.lastIndex = 0;
    const matches = contents.match(pattern) ?? [];
    if (matches.length > 0) {
      findings.push({
        file: path.relative(repositoryRoot, fileName),
        name,
        occurrences: matches.length,
      });
    }
  }
  return findings;
}

async function main() {
  const runId = createRunId();
  const applicationFiles = (
    await Promise.all([...applicationRoots, ...buildRoots].map(collectFiles))
  ).flat();
  const publicContentFiles = (
    await Promise.all(publicContentRoots.map(collectFiles))
  ).flat();
  const files = [...applicationFiles, ...publicContentFiles];
  const privateReferenceFindings = [];
  const secretFindings = [];

  for (const fileName of files) {
    const contents = await readFile(fileName, "utf8");
    privateReferenceFindings.push(
      ...findMatches(fileName, contents, forbiddenReferences),
    );
    secretFindings.push(...findMatches(fileName, contents, secretPatterns));
  }

  const projection = publicContentProjectionSchema.parse(
    JSON.parse(
      await readFile(
        path.join(repositoryRoot, "knowledge/public/content.json"),
        "utf8",
      ),
    ),
  );
  const manifest = publicContentManifestSchema.parse(
    JSON.parse(
      await readFile(
        path.join(repositoryRoot, "knowledge/public/content-manifest.json"),
        "utf8",
      ),
    ),
  );
  const publicVerification = JSON.parse(
    await readFile(path.join(evidenceDirectory, "public-content.json"), "utf8"),
  );
  const quickVerification = JSON.parse(
    await readFile(path.join(evidenceDirectory, "quick.json"), "utf8"),
  );
  const renderedItemIds = quickVerification.publicProjection?.renderedItemIds ?? [];
  const renderedClaims = quickVerification.publicProjection?.renderedClaims ?? [];
  const renderedClaimKeys = new Set(
    renderedClaims.map((claim) => `${claim.itemId}:${claim.field}`),
  );
  const expectedItemIds = projection.items.map((item) => item.id);
  const expectedClaimKeys = projection.items.flatMap((item) =>
    item.claims.map((claim) => `${item.id}:${claim.field}`),
  );
  const projectionPass =
    publicVerification.result === "pass" &&
    quickVerification.result === "pass" &&
    quickVerification.publicProjection?.contentHash === projection.contentHash &&
    manifest.projectionHash === projection.contentHash &&
    manifest.silentDropCount === 0 &&
    expectedItemIds.every((itemId) => renderedItemIds.includes(itemId)) &&
    expectedClaimKeys.every((claimKey) => renderedClaimKeys.has(claimKey)) &&
    Object.values(manifest.findings).every((count) => count === 0);

  const result =
    privateReferenceFindings.length === 0 &&
    secretFindings.length === 0 &&
    projectionPass
      ? "pass"
      : "fail";
  const evidence = {
    result,
    runId,
    scope: "desktop-homepage",
    filesScanned: files.length,
    applicationFilesScanned: applicationFiles.length,
    publicContentFilesScanned: publicContentFiles.length,
    privateSourceReferences: privateReferenceFindings.length,
    privateReferenceFindings,
    secretFindings: secretFindings.length,
    secretFindingDetails: secretFindings,
    publicProjection: {
      result: projectionPass ? "pass" : "fail",
      generationId: manifest.generationId,
      inputHash: manifest.inputHash,
      projectionHash: manifest.projectionHash,
      sourceCount: manifest.sourceCount,
      selectedCount: manifest.selectedCount,
      publishedCount: manifest.publishedCount,
      excludedCount: manifest.excludedCount,
      excludedByReason: manifest.excludedByReason,
      silentDropCount: manifest.silentDropCount,
      categoryCounts: manifest.categoryCounts,
      findings: manifest.findings,
      renderedClaimCount: renderedClaims.length,
      renderedClaims,
      renderedItemIds,
      expectedItemIds,
      renderingStatus: "approved-public-projection-rendered",
    },
  };

  await writeJsonAtomic("content.json", evidence);
  console.log(
    `content verification: ${result} (${files.length} files, ${manifest.publishedCount} published, ${manifest.excludedCount} excluded, ${manifest.silentDropCount} silent drops, ${privateReferenceFindings.length} private references, ${secretFindings.length} secret findings)`,
  );

  if (result !== "pass") {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  await writeJsonAtomic("content.json", {
    result: "fail",
    runId: createRunId(),
    scope: "desktop-homepage",
    error: error.message,
  });
  console.error(error);
  process.exitCode = 1;
});
