import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeRepositoryCollections,
  planInventoryUpdate,
  repositoryConceptId,
} from "../scripts/lib/github-inventory.mjs";
import { canReuseManifest, retainFailedCollectionRelationships } from "../scripts/github-sync.mjs";

function repository(overrides = {}) {
  return {
    id: 42,
    node_id: "R_42",
    name: "demo",
    full_name: "defulat-coder/demo",
    owner: { login: "defulat-coder", id: 7, type: "User" },
    html_url: "https://github.com/defulat-coder/demo",
    description: "演示项目",
    private: false,
    visibility: "public",
    fork: false,
    archived: false,
    disabled: false,
    is_template: false,
    default_branch: "main",
    language: "TypeScript",
    topics: ["agent", "okf"],
    license: { key: "mit", name: "MIT License", spdx_id: "MIT", url: null },
    stargazers_count: 3,
    forks_count: 1,
    watchers_count: 3,
    open_issues_count: 0,
    size: 128,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    pushed_at: "2026-06-30T00:00:00Z",
    ...overrides,
  };
}

test("inventory merges owned and followed collections into one stable repository concept", () => {
  const merged = mergeRepositoryCollections({
    owned: [repository({ private: true, visibility: "private", description: "所有者视图" })],
    starred: [{
      starred_at: "2025-05-01T00:00:00Z",
      repo: repository({ description: "公开视图" }),
    }],
    watched: [repository({ id: 99, node_id: "R_99", name: "watched", full_name: "other/watched" })],
  });

  assert.equal(merged.length, 2);
  assert.equal(merged[0].sourceId, "42");
  assert.deepEqual(merged[0].relationships, ["owned", "starred"]);
  assert.equal(merged[0].starredAt, "2025-05-01T00:00:00.000Z");
  assert.equal(merged[0].repository.private, true);
  assert.equal(merged[0].repository.description, "所有者视图");
  assert.equal(repositoryConceptId(42), "/github/repositories/42.md");
});

test("inventory update records metadata, relationship, addition, and deactivation changes", () => {
  const previous = [
    {
      sourceId: "42",
      repository: repository({ description: "旧描述" }),
      relationships: ["owned", "starred"],
      starredAt: "2025-05-01T00:00:00.000Z",
      active: true,
      firstSeenAt: "2025-01-01T00:00:00.000Z",
      lastChangedAt: "2025-05-01T00:00:00.000Z",
      inactiveSince: null,
      previousRelationships: [],
      readme: null,
    },
    {
      sourceId: "88",
      repository: repository({ id: 88, node_id: "R_88", name: "old-star", full_name: "other/old-star" }),
      relationships: ["starred"],
      starredAt: "2024-01-01T00:00:00.000Z",
      active: true,
      firstSeenAt: "2024-01-01T00:00:00.000Z",
      lastChangedAt: "2024-01-01T00:00:00.000Z",
      inactiveSince: null,
      previousRelationships: [],
      readme: null,
    },
  ];
  const current = mergeRepositoryCollections({
    owned: [repository({ description: "新描述" })],
    starred: [{ repo: repository({ id: 99, node_id: "R_99", name: "new-star", full_name: "other/new-star" }), starred_at: "2026-07-18T00:00:00Z" }],
    watched: [],
  });

  const planned = planInventoryUpdate({
    current,
    previous,
    observedAt: "2026-07-18T08:00:00Z",
  });

  assert.deepEqual(planned.changes.map((change) => ({
    sourceId: change.sourceId,
    added: change.added,
    metadataUpdated: change.metadataUpdated,
    deactivated: change.deactivated,
    relationshipsAdded: change.relationshipsAdded,
    relationshipsRemoved: change.relationshipsRemoved,
  })), [
    {
      sourceId: "42",
      added: false,
      metadataUpdated: true,
      deactivated: false,
      relationshipsAdded: [],
      relationshipsRemoved: ["starred"],
    },
    {
      sourceId: "88",
      added: false,
      metadataUpdated: false,
      deactivated: true,
      relationshipsAdded: [],
      relationshipsRemoved: ["starred"],
    },
    {
      sourceId: "99",
      added: true,
      metadataUpdated: false,
      deactivated: false,
      relationshipsAdded: ["starred"],
      relationshipsRemoved: [],
    },
  ]);
  assert.equal(planned.records.find((record) => record.sourceId === "88").active, false);
  assert.deepEqual(planned.records.find((record) => record.sourceId === "88").previousRelationships, ["starred"]);
});

test("inventory update is stable when a later sync observes no source changes", () => {
  const observedAt = "2026-07-18T08:00:00Z";
  const current = mergeRepositoryCollections({ owned: [repository()], starred: [], watched: [] });
  const initial = planInventoryUpdate({ current, previous: [], observedAt });
  const repeated = planInventoryUpdate({
    current,
    previous: initial.records,
    observedAt: "2026-07-19T08:00:00Z",
  });

  assert.deepEqual(repeated.changes, []);
  assert.deepEqual(repeated.records, initial.records);
});

test("a failed collection fetch retains the last known relationships instead of deactivating repositories", () => {
  const previous = planInventoryUpdate({
    current: mergeRepositoryCollections({
      owned: [repository()],
      starred: [{ repo: repository(), starred_at: "2026-01-01T00:00:00Z" }],
      watched: [],
    }),
    previous: [],
    observedAt: "2026-07-17T00:00:00Z",
  }).records;
  const currentFromSuccessfulCollections = mergeRepositoryCollections({
    owned: [],
    starred: [{ repo: repository(), starred_at: "2026-01-01T00:00:00Z" }],
    watched: [],
  });

  const retained = retainFailedCollectionRelationships(
    currentFromSuccessfulCollections,
    previous,
    new Set(["owned"]),
  );

  assert.equal(retained.length, 1);
  assert.deepEqual(retained[0].relationships, ["owned", "starred"]);
  assert.equal(retained[0].active, true);
});

test("a cleared optional-source warning forces a fresh manifest instead of retaining stale warnings", () => {
  const account = { id: 7, login: "defulat-coder" };
  const config = { api_version: "2026-03-10" };
  const counts = { repositories: 1 };
  const collectionSummary = { owned: { count: 1, complete: true } };
  const rawResponseObjects = [{ kind: "owned", sha256: "a".repeat(64), path: "responses/owned/a.json", item_count: 1 }];
  const previousManifest = {
    complete: true,
    api_version: config.api_version,
    account: { id: "7", login: account.login },
    counts,
    collections: collectionSummary,
    raw_responses: rawResponseObjects,
    warnings: [{ code: "readme-fetch-failed", source_id: "42" }],
    errors: [],
  };

  assert.equal(canReuseManifest({
    previousManifest,
    changes: [],
    complete: true,
    config,
    account,
    counts,
    collectionSummary,
    rawResponseObjects,
    warnings: [],
    errors: [],
  }), false);
});
