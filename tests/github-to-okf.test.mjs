import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { generateGithubBundle } from "../scripts/github-to-okf.mjs";

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("GitHub generator writes one stable OKF concept with merged relations and README evidence", async (context) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "github-okf-"));
  context.after(() => rm(temporary, { recursive: true, force: true }));
  const rawRoot = path.join(temporary, "raw");
  const stagingRoot = path.join(temporary, "bundle");
  await mkdir(rawRoot, { recursive: true });
  await mkdir(stagingRoot, { recursive: true });
  const readmeBytes = Buffer.from("# Demo README\n\nEvidence body.\n", "utf8");
  const readmeSha = digest(readmeBytes);
  const readmePath = `blobs/readme/${readmeSha.slice(0, 2)}/${readmeSha}.bin`;
  await mkdir(path.join(rawRoot, path.dirname(readmePath)), { recursive: true });
  await writeFile(path.join(rawRoot, readmePath), readmeBytes);
  const record = {
    sourceId: "42",
    repository: {
      id: "42",
      node_id: "R_42",
      name: "demo",
      full_name: "defulat-coder/demo",
      owner: { login: "defulat-coder", id: "7", type: "User" },
      html_url: "https://github.com/defulat-coder/demo",
      description: "Demo repository",
      homepage: null,
      private: false,
      visibility: "public",
      fork: false,
      archived: false,
      disabled: false,
      is_template: false,
      default_branch: "main",
      language: "TypeScript",
      topics: ["agent", "okf"],
      license: null,
      stargazers_count: 2,
      forks_count: 1,
      watchers_count: 2,
      open_issues_count: 0,
      size: 100,
      has_issues: true,
      has_projects: true,
      has_wiki: true,
      has_pages: false,
      has_downloads: true,
      has_discussions: false,
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2026-07-18T00:00:00.000Z",
      pushed_at: "2026-07-17T00:00:00.000Z"
    },
    relationships: ["owned", "starred"],
    starredAt: "2026-01-01T00:00:00.000Z",
    active: true,
    firstSeenAt: "2026-07-18T00:00:00.000Z",
    lastChangedAt: "2026-07-18T00:00:00.000Z",
    inactiveSince: null,
    previousRelationships: [],
    remoteStatus: "available",
    readme: {
      status: "available",
      name: "README.md",
      path: readmePath,
      sha256: readmeSha,
      size: readmeBytes.length,
      pushed_at: "2026-07-17T00:00:00.000Z",
      fetched_at: "2026-07-18T00:00:00.000Z"
    }
  };
  const objectPayload = Buffer.from(`${JSON.stringify({
    schema_version: "1.0.0",
    kind: "repository",
    source_system: "github",
    source_id: "42",
    record,
  }, null, 2)}\n`, "utf8");
  const objectSha = digest(objectPayload);
  const objectPath = `objects/repository/42/${objectSha}.json`;
  await mkdir(path.join(rawRoot, path.dirname(objectPath)), { recursive: true });
  await writeFile(path.join(rawRoot, objectPath), objectPayload);
  const manifestBytes = Buffer.from(`${JSON.stringify({
    schema_version: "1.0.0",
    source_system: "github",
    api_version: "2026-03-10",
    account: { id: "7", login: "defulat-coder", name: "AI Coder", html_url: "https://github.com/defulat-coder" },
    snapshot_at: "2026-07-18T00:00:00.000Z",
    complete: true,
    collections: {
      owned: { count: 1, complete: true },
      starred: { count: 1, complete: true },
      watched: { count: 0, complete: true }
    },
    counts: { repositories: 1, active: 1, inactive: 0, owned: 1, starred: 1, watched: 0, owned_originals: 1, owned_forks: 0, private: 0, archived: 0, readmes: 1 },
    objects: [{ kind: "repository", source_id: "42", sha256: objectSha, path: objectPath, active: true, relationships: ["owned", "starred"], remote_status: "available" }],
    changes: [],
    warnings: [],
    errors: []
  }, null, 2)}\n`, "utf8");
  await writeFile(path.join(rawRoot, "manifest.json"), manifestBytes);

  const result = await generateGithubBundle({
    config: { okf_version: "0.1" },
    rawRoot,
    stagingRoot,
    manifest: JSON.parse(manifestBytes.toString("utf8")),
    manifestBytes,
  });

  assert.equal(result.repositories, 1);
  const concept = await readFile(path.join(stagingRoot, "github/repositories/42.md"), "utf8");
  assert.match(concept, /^---\ntype: "GitHub Repository"/u);
  assert.match(concept, /source_id: "42"/u);
  assert.match(concept, /github_relationships: \["owned", "starred"\]/u);
  assert.match(concept, new RegExp(`readme_source_object: ${JSON.stringify(readmePath)}`, "u"));
  assert.match(concept, /# Demo README/u);
  const ownedIndex = await readFile(path.join(stagingRoot, "github/owned/index.md"), "utf8");
  assert.match(ownedIndex, /\[defulat-coder\/demo\]\(\/github\/repositories\/42\.md\)/u);
  const report = JSON.parse(await readFile(path.join(stagingRoot, "github-curation.json"), "utf8"));
  assert.equal(report.items[0].concept_id, "/github/repositories/42.md");
  assert.deepEqual(report.items[0].relationships, ["owned", "starred"]);
});
