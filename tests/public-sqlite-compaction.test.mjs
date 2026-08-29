import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import Database from "better-sqlite3";

import { compactPublicDatabase } from "../modules/public-data/sqlite.mjs";

test("public SQLite compaction vacuums meaningful free space and skips compact files", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "public-sqlite-compaction-"));
  const database = new Database(path.join(directory, "public.sqlite"));
  try {
    database.exec(`
      CREATE TABLE payload (value BLOB);
      WITH RECURSIVE rows(i) AS (VALUES(1) UNION ALL SELECT i + 1 FROM rows WHERE i < 512)
      INSERT INTO payload SELECT zeroblob(4096) FROM rows;
      DELETE FROM payload;
    `);
    assert.ok(database.pragma("freelist_count", { simple: true }) >= 128);

    const compacted = compactPublicDatabase(database);
    assert.equal(compacted.compacted, true);
    assert.equal(compacted.freePagesAfter, 0);
    assert.equal(database.pragma("quick_check", { simple: true }), "ok");

    assert.equal(compactPublicDatabase(database).compacted, false);
  } finally {
    database.close();
    await rm(directory, { force: true, recursive: true });
  }
});
