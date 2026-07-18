import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.resolve(projectRoot, process.argv[2] ?? "config/yuque-sync.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const rawRoot = resolveInside(projectRoot, config.storage?.raw_root ?? "data/private/yuque/raw");
const manifest = JSON.parse(await readFile(path.join(rawRoot, "manifest.json"), "utf8"));
const coverage = JSON.parse(await readFile(path.join(rawRoot, "coverage.json"), "utf8"));
const failures = [];
const warnings = [];
let checkedFiles = 0;

function resolveInside(root, child) {
  const resolved = path.resolve(root, child);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Path escapes raw root: ${child}`);
  return resolved;
}

async function hashFile(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function verifyFile(entry, label) {
  try {
    const absolute = resolveInside(rawRoot, entry.path);
    const actual = await hashFile(absolute);
    checkedFiles += 1;
    if (actual !== entry.sha256) failures.push(`${label} hash mismatch`);
  } catch (error) {
    failures.push(`${label} missing or unreadable: ${error.code ?? error.message}`);
  }
}

if (manifest.schema_version !== "1.0.0") failures.push("manifest schema version is unsupported");
if (coverage.schema_version !== "1.0.0") failures.push("coverage schema version is unsupported");
if (JSON.stringify(manifest.coverage) !== JSON.stringify(coverage)) failures.push("manifest coverage differs from coverage.json");
if (manifest.objects.length !== coverage.counts.objects) failures.push("object count differs from coverage");
if (manifest.assets.length !== coverage.counts.assets_saved) failures.push("asset count differs from coverage");

for (const record of manifest.objects ?? []) {
  await verifyFile(record, record.key);
  for (const blob of record.blobs ?? []) await verifyFile(blob, `${record.key}:${blob.format}`);
}
for (const asset of manifest.assets ?? []) await verifyFile(asset, asset.key);

if (!coverage.pagination_complete) failures.push("pagination coverage is incomplete");
if (!coverage.declared_document_counts_match) warnings.push("listed document counts differ from declared counts");
if ((coverage.errors?.length ?? 0) > 0) failures.push(`coverage contains ${coverage.errors.length} errors`);
if (!coverage.complete) failures.push("coverage.complete is false");

for (const warning of warnings) console.warn(`WARN ${warning}`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`ERROR ${failure}`);
  console.error(`Yuque verification failed after checking ${checkedFiles} files`);
  process.exitCode = 1;
} else {
  console.log(`Yuque data verified: ${coverage.counts.books} books, ${coverage.counts.documents_listed} documents, ${coverage.counts.notes_listed} notes, ${checkedFiles} files`);
}
