import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { toProjectSearchDocuments } from "../ask/search-index.mjs";
import { compactPublicDatabase, initializePublicDatabase, replaceAskDocuments, PUBLIC_DATABASE_PATH } from "../public-data/sqlite.mjs";
import { approvedProjectSchema, publicProjectSnapshotSchema } from "./schema.mjs";
import { assertPublicContentSafe, canonicalJson, readJson, sha256, writePrivateJson } from "./source.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function assertPublicSnapshotSafe(snapshot) {
  return assertPublicContentSafe(snapshot);
}

export function buildPublicProjectSnapshot(project, approved) {
  const parsed = approvedProjectSchema.parse(approved);
  const snapshot = publicProjectSnapshotSchema.parse({
    ...(parsed.bodyMarkdown ? { bodyMarkdown: parsed.bodyMarkdown } : {}),
    currentFocus: parsed.currentFocus,
    period: project.period,
    projectId: project.id,
    records: parsed.records,
    ...(project.repo ? { repo: project.repo } : {}),
    role: project.role,
    shots: project.shots,
    slug: project.slug,
    sourceObservedAt: parsed.sourceObservedAt,
    stack: project.stack,
    status: project.status,
    summary: parsed.summary,
    title: project.title,
    ...(project.url ? { url: project.url } : {}),
    version: 1,
  });
  assertPublicSnapshotSafe(snapshot);
  return { revision: sha256(canonicalJson(snapshot)), snapshot };
}

export async function publishApprovedProject({
  databasePath = path.join(repoRoot, PUBLIC_DATABASE_PATH),
  now = new Date(),
  paths,
  project,
}) {
  const approved = approvedProjectSchema.parse(await readJson(paths.approved));
  const { revision, snapshot } = buildPublicProjectSnapshot(project, approved);
  const publishedAt = now.toISOString();
  const database = initializePublicDatabase(new Database(databasePath));
  try {
    database.transaction(() => {
      database.prepare(`
        INSERT INTO project_snapshots (project_id, slug, display_order, published_at, revision, snapshot_json)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET
          slug = excluded.slug,
          display_order = excluded.display_order,
          published_at = excluded.published_at,
          revision = excluded.revision,
          snapshot_json = excluded.snapshot_json
      `).run(project.id, project.slug, project.order, publishedAt, revision, JSON.stringify(snapshot));
      replaceAskDocuments(
        database,
        "works",
        project.id,
        toProjectSearchDocuments([{ published_at: publishedAt, snapshot }]),
      );
    })();
    const row = database.prepare(
      "SELECT project_id, revision, snapshot_json FROM project_snapshots WHERE project_id = ?",
    ).get(project.id);
    if (row.project_id !== project.id || row.revision !== revision) {
      throw new Error(`${project.id} 项目快照回读修订不一致。`);
    }
    publicProjectSnapshotSchema.parse(JSON.parse(row.snapshot_json));
    compactPublicDatabase(database);
  } finally {
    database.close();
  }
  const state = (await readJson(paths.state)) ?? {};
  await writePrivateJson(paths.state, { ...state, publishedAt, publishedRevision: revision });
  return { publishedAt, recordCount: snapshot.records.length, revision, snapshot };
}
