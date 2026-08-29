import Database from "better-sqlite3";
import { existsSync } from "node:fs";

import { toProfileSearchDocument, toProjectSearchDocuments } from "../ask/search-index.mjs";

export const PUBLIC_DATABASE_PATH = "data/curation.sqlite";

export function compactPublicDatabase(database, minimumFreePages = 32) {
  const freePagesBefore = Number(database.pragma("freelist_count", { simple: true }));
  if (freePagesBefore < minimumFreePages) {
    return { compacted: false, freePagesAfter: freePagesBefore, freePagesBefore };
  }
  database.exec("VACUUM");
  return {
    compacted: true,
    freePagesAfter: Number(database.pragma("freelist_count", { simple: true })),
    freePagesBefore,
  };
}

export function initializePublicDatabase(database) {
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS curation_items (
      id TEXT PRIMARY KEY,
      collected_at TEXT,
      collected_order INTEGER,
      published_at TEXT,
      title TEXT NOT NULL,
      content_json TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS curation_items_feed_order_idx
      ON curation_items (collected_at DESC, collected_order ASC, published_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS open_source_items (
      repo_node_id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      display_rank INTEGER NOT NULL,
      published_at TEXT NOT NULL,
      content_json TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS open_source_items_order_idx
      ON open_source_items (display_rank ASC, published_at DESC);

    CREATE TABLE IF NOT EXISTS project_snapshots (
      project_id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      display_order INTEGER NOT NULL,
      published_at TEXT NOT NULL,
      revision TEXT NOT NULL,
      snapshot_json TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS project_snapshots_order_idx
      ON project_snapshots (display_order ASC, published_at DESC);

    CREATE TABLE IF NOT EXISTS ask_documents (
      id TEXT PRIMARY KEY,
      source_scope TEXT NOT NULL CHECK (source_scope IN ('daily', 'open-source', 'profile', 'works')),
      source_id TEXT NOT NULL,
      title TEXT NOT NULL,
      section TEXT,
      source_url TEXT NOT NULL,
      published_at TEXT,
      content TEXT NOT NULL,
      search_text TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS ask_documents_scope_order_idx
      ON ask_documents (source_scope, published_at DESC);

    CREATE VIRTUAL TABLE IF NOT EXISTS ask_documents_fts USING fts5(
      title,
      search_text,
      content = 'ask_documents',
      content_rowid = 'rowid',
      tokenize = 'unicode61 remove_diacritics 2'
    );
    CREATE TRIGGER IF NOT EXISTS ask_documents_fts_insert AFTER INSERT ON ask_documents BEGIN
      INSERT INTO ask_documents_fts(rowid, title, search_text)
      VALUES (new.rowid, new.title, new.search_text);
    END;
    CREATE TRIGGER IF NOT EXISTS ask_documents_fts_delete AFTER DELETE ON ask_documents BEGIN
      INSERT INTO ask_documents_fts(ask_documents_fts, rowid, title, search_text)
      VALUES ('delete', old.rowid, old.title, old.search_text);
    END;
    CREATE TRIGGER IF NOT EXISTS ask_documents_fts_update AFTER UPDATE ON ask_documents BEGIN
      INSERT INTO ask_documents_fts(ask_documents_fts, rowid, title, search_text)
      VALUES ('delete', old.rowid, old.title, old.search_text);
      INSERT INTO ask_documents_fts(rowid, title, search_text)
      VALUES (new.rowid, new.title, new.search_text);
    END;
    INSERT INTO ask_documents_fts(ask_documents_fts) VALUES ('rebuild');
  `);
  insertAskDocuments(database, [toProfileSearchDocument()]);
  return database;
}

export function insertAskDocuments(database, documents) {
  const insert = database.prepare(`
    INSERT INTO ask_documents (id, source_scope, source_id, title, section, source_url, published_at, content, search_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      source_scope = excluded.source_scope,
      source_id = excluded.source_id,
      title = excluded.title,
      section = excluded.section,
      source_url = excluded.source_url,
      published_at = excluded.published_at,
      content = excluded.content,
      search_text = excluded.search_text
  `);
  for (const document of documents) {
    insert.run(
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
}

export function replaceAskDocuments(database, scope, sourceId, documents) {
  database.prepare("DELETE FROM ask_documents WHERE source_scope = ? AND source_id = ?").run(scope, sourceId);
  insertAskDocuments(database, documents);
}

export function preserveSupplementalProjection(sourcePath, targetDatabase) {
  if (!existsSync(sourcePath)) return;
  const source = new Database(sourcePath, { fileMustExist: true, readonly: true });
  try {
    const tables = new Set(source.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
    const copy = (table, columns) => {
      if (!tables.has(table)) return;
      const placeholders = columns.map(() => "?").join(", ");
      const insert = targetDatabase.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`);
      const transaction = targetDatabase.transaction((rows) => {
        for (const row of rows) insert.run(...columns.map((column) => row[column]));
      });
      transaction(source.prepare(`SELECT ${columns.join(", ")} FROM ${table}`).all());
    };
    copy("open_source_items", ["repo_node_id", "slug", "display_rank", "published_at", "content_json"]);
    copy("project_snapshots", ["project_id", "slug", "display_order", "published_at", "revision", "snapshot_json"]);
    if (tables.has("ask_documents")) {
      const columns = ["id", "source_scope", "source_id", "title", "section", "source_url", "published_at", "content", "search_text"];
      const rows = source.prepare(`SELECT ${columns.join(", ")} FROM ask_documents WHERE source_scope = 'open-source'`).all();
      const insert = targetDatabase.prepare(`INSERT INTO ask_documents (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`);
      targetDatabase.transaction(() => {
        for (const row of rows) insert.run(...columns.map((column) => row[column]));
      })();
    }
    const projectRows = targetDatabase.prepare("SELECT published_at, snapshot_json FROM project_snapshots").all();
    insertAskDocuments(targetDatabase, toProjectSearchDocuments(projectRows.map((row) => ({
      published_at: row.published_at,
      snapshot: JSON.parse(row.snapshot_json),
    }))));
  } finally {
    source.close();
  }
}
