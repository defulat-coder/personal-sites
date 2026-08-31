import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";

import { projectCatalog } from "../config/project-catalog.mjs";

test("构建样张配置与公开快照使用当前栏目术语", () => {
  const configured = projectCatalog.find((project) => project.id === "personal-sites");
  const database = new Database("data/curation.sqlite", { readonly: true });
  try {
    const row = database.prepare("SELECT snapshot_json FROM project_snapshots WHERE project_id = ?").get("personal-sites");
    const published = JSON.parse(row.snapshot_json);
    const expectedLabels = ["每日动态", "每日关注", "开源关注", "问一问"];
    assert.deepEqual(configured.shots.map((shot) => shot.label), expectedLabels);
    assert.deepEqual(published.shots.map((shot) => shot.label), expectedLabels);
  } finally {
    database.close();
  }
});
