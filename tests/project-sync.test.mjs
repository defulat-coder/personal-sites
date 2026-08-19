import assert from "node:assert/strict";
import test from "node:test";

import { sanitizePublicCandidate } from "../modules/project-sync/derive.mjs";
import { assertPublicSnapshotSafe, buildPublicProjectSnapshot } from "../modules/project-sync/publish.mjs";
import { canonicalJson, extractMemoryBlocks, sha256 } from "../modules/project-sync/source.mjs";

test("canonicalJson 对对象键顺序稳定", () => {
  assert.equal(canonicalJson({ b: 2, a: { d: 4, c: 3 } }), canonicalJson({ a: { c: 3, d: 4 }, b: 2 }));
  assert.equal(sha256(canonicalJson({ b: 2, a: 1 })), sha256(canonicalJson({ a: 1, b: 2 })));
});

test("Codex 记录只归入匹配项目根目录", () => {
  const markdown = [
    "# Task Group: A\napplies_to: cwd=/workspace/a\n## Task 1: A1, success\n",
    "# Task Group: B\napplies_to: cwd=/workspace/b\n## Task 1: B1, success\n",
  ].join("\n");
  assert.deepEqual(extractMemoryBlocks(markdown, ["/workspace/a"]).map((item) => item.match(/^# Task Group: (.+)$/mu)?.[1]), ["A"]);
});

test("项目公开修订不受批准时间影响", () => {
  const project = {
    id: "demo",
    period: "2026",
    role: "开发",
    shots: [],
    slug: "demo",
    stack: ["TypeScript"],
    status: "在役",
    title: "Demo",
  };
  const base = {
    approvedDigest: "a".repeat(64),
    bodyMarkdown: "正文",
    currentFocus: "验证增量同步",
    extractorVersion: "v1",
    generatedAt: "2026-08-20T00:00:00.000Z",
    projectId: "demo",
    records: [{
      evidence: [{ id: "git:1", kind: "commit", label: "feat", occurredAt: "2026-08-20T00:00:00.000Z", verifiedAt: "2026-08-20T00:00:00.000Z" }],
      id: "incremental-sync",
      kind: "capability",
      occurredAt: "2026-08-20T00:00:00.000Z",
      relatedRecordIds: [],
      status: "active",
      summary: "可以增量同步。",
      title: "增量同步",
      topics: ["sync"],
      updatedAt: "2026-08-20T00:00:00.000Z",
    }],
    sourceDigest: "b".repeat(64),
    sourceObservedAt: "2026-08-20T00:00:00.000Z",
    summary: "项目摘要",
  };
  const first = buildPublicProjectSnapshot(project, { ...base, approvedAt: "2026-08-20T01:00:00.000Z" });
  const second = buildPublicProjectSnapshot(project, { ...base, approvedAt: "2026-08-20T02:00:00.000Z" });
  assert.equal(first.revision, second.revision);
});

test("公开快照拒绝本机绝对路径", () => {
  assert.throws(() => assertPublicSnapshotSafe({ summary: "见 /Users/example/private.txt" }), /敏感内容/u);
  assert.equal(assertPublicSnapshotSafe({ summary: "公开内容" }), true);
});

test("公开候选在审核前清理本机敏感路径", () => {
  const candidate = sanitizePublicCandidate({
    body: "读取 /Users/example/repo/data/sensitive/source.json 与 .codex/sessions/run.jsonl",
  });
  assert.equal(candidate.body.includes("/Users/"), false);
  assert.equal(candidate.body.includes("data/sensitive"), false);
  assert.equal(candidate.body.includes(".codex/sessions"), false);
  assert.equal(assertPublicSnapshotSafe(candidate), true);
});
