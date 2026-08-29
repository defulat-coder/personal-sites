import Database from "better-sqlite3";
import { mkdtemp, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";

import { toDailySearchDocuments } from "../ask/search-index.mjs";
import {
  compactPublicDatabase,
  initializePublicDatabase,
  preserveSupplementalProjection,
  PUBLIC_DATABASE_PATH,
} from "../public-data/sqlite.mjs";

export const PUBLIC_CURATION_DATABASE_PATH = PUBLIC_DATABASE_PATH;

function sortPublicFocusItems(items) {
  return [...items].sort((left, right) =>
    (right.collectedAt ?? "").localeCompare(left.collectedAt ?? "")
    || (left.collectedOrder ?? Number.MAX_SAFE_INTEGER) - (right.collectedOrder ?? Number.MAX_SAFE_INTEGER)
    || (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "")
    || right.id.localeCompare(left.id),
  );
}

/** Build the Git-tracked, read-only projection. Sensitive source queues never leave this process. */
export async function buildPublicCurationDatabase({ outputPath, items: unsortedItems }) {
  const items = sortPublicFocusItems(unsortedItems);
  if (items.length === 0) throw new Error("没有已批准的每日关注条目，无法生成公开 SQLite 投影。");

  const outputDirectory = path.dirname(outputPath);
  await mkdir(outputDirectory, { recursive: true });
  const temporaryDirectory = await mkdtemp(path.join(outputDirectory, ".curation-sqlite-"));
  const temporaryPath = path.join(temporaryDirectory, "curation.sqlite");

  try {
    const database = initializePublicDatabase(new Database(temporaryPath));
    database.pragma("journal_mode = DELETE");
    preserveSupplementalProjection(outputPath, database);

    const insertItem = database.prepare(`
      INSERT INTO curation_items (id, collected_at, collected_order, published_at, title, content_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      insertItem.run(item.id, item.collectedAt, item.collectedOrder, item.publishedAt, item.title, JSON.stringify(item));
    }

    const insertDocument = database.prepare(`
      INSERT INTO ask_documents (id, source_scope, published_at, title, content, search_text, source_id, source_url)
      VALUES (?, 'daily', ?, ?, ?, ?, ?, ?)
    `);
    const documents = toDailySearchDocuments(items.map((content) => ({ content, published_at: content.publishedAt })));
    for (const document of documents) {
      insertDocument.run(
        document.id,
        document.published_at,
        document.title,
        document.content,
        document.search_text,
        document.source_id,
        document.source_url,
      );
    }
    compactPublicDatabase(database);
    database.close();

    await rename(temporaryPath, outputPath);
    return { documentCount: documents.length, itemCount: items.length };
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}
