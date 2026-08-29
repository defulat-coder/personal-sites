import assert from "node:assert/strict";
import test from "node:test";

import Database from "better-sqlite3";

import { readPublicDataHealth } from "../modules/data-health/sqlite.mjs";
import { buildDataHealth } from "../modules/data-health/status.mjs";

const now = new Date("2026-08-29T12:00:00.000Z");
const base = {
  aiNews: { ageMinutes: 5, healthy: true, lastSucceededAt: "2026-08-29T11:55:00.000Z", running: false },
  now,
  publicData: {
    askDocuments: 10,
    askFts: 10,
    askMissingFts: 0,
    askOrphanFts: 0,
    curation: {
      douyin: { count: 5, latestAt: "2026-08-29T10:00:00.000Z" },
      x: { count: 5, latestAt: "2026-08-29T11:00:00.000Z" },
    },
    openSource: { count: 3, latestAt: "2026-08-28T12:00:00.000Z" },
    quickCheck: "ok",
    works: { count: 2, latestAt: "2026-08-20T12:00:00.000Z" },
  },
};

test("healthy public projections pass through one data-health interface", () => {
  const status = buildDataHealth(base);
  assert.equal(status.healthy, true);
  assert.deepEqual(status.warnings, []);
});

test("SQLite health evidence reads integrity, freshness, and bidirectional FTS alignment", () => {
  const database = new Database(":memory:");
  database.exec(`
    CREATE TABLE curation_items (content_json TEXT, collected_at TEXT, published_at TEXT);
    CREATE TABLE open_source_items (published_at TEXT);
    CREATE TABLE project_snapshots (published_at TEXT);
    CREATE TABLE ask_documents (id TEXT, content TEXT);
    CREATE VIRTUAL TABLE ask_documents_fts USING fts5(content, content='ask_documents', content_rowid='rowid');
    INSERT INTO curation_items VALUES ('{"source":{"platform":"x"}}', '2026-08-29T10:00:00.000Z', null);
    INSERT INTO curation_items VALUES ('{"source":{"platform":"douyin"}}', '2026-08-29T09:00:00.000Z', null);
    INSERT INTO open_source_items VALUES ('2026-08-28T12:00:00.000Z');
    INSERT INTO project_snapshots VALUES ('2026-08-27T12:00:00.000Z');
    INSERT INTO ask_documents VALUES ('one', 'Agent runtime');
    INSERT INTO ask_documents_fts(rowid, content) VALUES (1, 'Agent runtime');
  `);

  const evidence = readPublicDataHealth(database);
  database.close();

  assert.equal(evidence.quickCheck, "ok");
  assert.deepEqual(
    { documents: evidence.askDocuments, fts: evidence.askFts, missing: evidence.askMissingFts, orphan: evidence.askOrphanFts },
    { documents: 1, fts: 1, missing: 0, orphan: 0 },
  );
  assert.equal(evidence.curation.x.count, 1);
  assert.equal(evidence.curation.douyin.count, 1);
});

test("equal Ask counts cannot hide SQLite corruption or mismatched FTS rowids", () => {
  const status = buildDataHealth({
    ...base,
    publicData: {
      ...base.publicData,
      askMissingFts: 1,
      askOrphanFts: 1,
      quickCheck: "database disk image is malformed",
    },
  });

  assert.equal(status.healthy, false);
  assert.equal(status.database.healthy, false);
  assert.equal(status.askIndex.healthy, false);
  assert.match(status.warnings.join("\n"), /SQLite|FTS/u);
});

test("stale or inconsistent projections fail health with an actionable warning", () => {
  const status = buildDataHealth({
    ...base,
    publicData: {
      ...base.publicData,
      askFts: 9,
      curation: {
        ...base.publicData.curation,
        x: { count: 5, latestAt: "2026-08-20T11:00:00.000Z" },
      },
    },
  });
  assert.equal(status.healthy, false);
  assert.equal(status.askIndex.healthy, false);
  assert.match(status.warnings.join("\n"), /X 策展/u);
});
