import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { toOpenSourceSearchDocuments } from "../ask/search-index.mjs";
import { compactPublicDatabase, initializePublicDatabase, PUBLIC_DATABASE_PATH } from "../public-data/sqlite.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function toPublicOpenSourceItem(record, analysis, entry, displayRank, now) {
  return {
    content: {
      category: entry.category,
      caveats: entry.caveats,
      dimensions: entry.dimensions,
      evidence: entry.evidence,
      judgement: entry.judgement,
      nextStep: entry.nextStep,
      parsedMarkdown: analysis.contentMarkdown,
      personalNote: entry.personalNote,
      repository: entry.repository,
      repositoryDefaultBranch: record.repository.defaultBranch,
      repositoryUrl: entry.repositoryUrl,
      readingSource: record.readingMarkdown ? "official-zh-readme" : "kimi-translation",
      readingSourcePath: record.readingSourcePath,
      scenarios: entry.scenarios,
      slug: entry.slug,
      sourceMarkdown: record.sourceMarkdown,
      sourceSummary: analysis.oneLineSummary ?? entry.sourceSummary,
      sourceTitle: record.sourceKind === "readme" ? "原始 README" : "仓库结构证据",
      status: entry.status,
      type: entry.type,
      workflow: entry.workflow,
    },
    display_rank: displayRank,
    published_at: now,
    repo_node_id: record.repository.nodeId,
    slug: entry.slug,
  };
}

/** Publish the selected public projection locally; raw sources and analyses already live in data/sensitive. */
export async function publishStarredRecords({
  analyses = [],
  databasePath = path.join(repoRoot, PUBLIC_DATABASE_PATH),
  now = new Date().toISOString(),
  records,
  seedEntries = [],
}) {
  const analysisByNodeId = new Map(analyses.map((analysis) => [analysis.repoNodeId, analysis]));
  const seedByRepository = new Map(seedEntries.map((entry, index) => [entry.repository, { entry, index }]));
  const publicRows = records.flatMap((record) => {
    const selected = seedByRepository.get(record.repository.fullName);
    const analysis = analysisByNodeId.get(record.repository.nodeId);
    return selected && analysis
      ? [toPublicOpenSourceItem(record, analysis, selected.entry, selected.index, now)]
      : [];
  });
  const documents = toOpenSourceSearchDocuments(publicRows);
  const database = initializePublicDatabase(new Database(databasePath));
  try {
    const deleteItem = database.prepare("DELETE FROM open_source_items WHERE repo_node_id = ?");
    const deleteDocuments = database.prepare("DELETE FROM ask_documents WHERE source_scope = 'open-source' AND source_id = ?");
    const insertItem = database.prepare(`
      INSERT INTO open_source_items (repo_node_id, slug, display_rank, published_at, content_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(repo_node_id) DO UPDATE SET
        slug = excluded.slug,
        display_rank = excluded.display_rank,
        published_at = excluded.published_at,
        content_json = excluded.content_json
    `);
    const insertDocument = database.prepare(`
      INSERT INTO ask_documents
        (id, source_scope, source_id, title, section, source_url, published_at, content, search_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    database.transaction(() => {
      for (const record of records) {
        deleteItem.run(record.repository.nodeId);
        deleteDocuments.run(record.repository.nodeId);
      }
      for (const row of publicRows) {
        insertItem.run(row.repo_node_id, row.slug, row.display_rank, row.published_at, JSON.stringify(row.content));
      }
      for (const document of documents) {
        insertDocument.run(
          document.id,
          document.source_scope,
          document.source_id,
          document.title,
          document.section,
          document.source_url,
          document.published_at,
          document.content,
          document.search_text,
        );
      }
    })();
    compactPublicDatabase(database);
  } finally {
    database.close();
  }

  return {
    indexedCount: documents.length,
    privateAnalysisCount: analyses.length,
    privateSourceCount: records.length,
    publicCount: publicRows.length,
  };
}
