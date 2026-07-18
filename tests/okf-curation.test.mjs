import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExactDuplicatePlan,
  buildTitleCollisionGroups,
  classifyContent,
  cleanMarkdownBody,
  deriveConceptTitle,
  findNearDuplicatePairs,
  hasEmbeddedResource,
  normalizeContentForFingerprint,
  normalizeExactContent,
  removeRedundantLeadingHeading,
} from "../scripts/lib/okf-curation.mjs";

test("producer cleans source-only formatting without rewriting knowledge", () => {
  const source = "\uFEFF---\r\ntitle: Source metadata\r\n---\r\n# 标题  \r\n\u200B正文\t \r\n\r\n\r\n\r\n结尾\r\n";

  assert.equal(cleanMarkdownBody(source), "# 标题\n正文\n\n结尾");
  assert.equal(
    cleanMarkdownBody("---\n这只是正文分隔\n---\n后续正文"),
    "---\n这只是正文分隔\n---\n后续正文",
  );
});

test("producer folds exact copies into a stable canonical concept", () => {
  const plan = buildExactDuplicatePlan([
    {
      conceptId: "/yuque/notes/9.md",
      kind: "note",
      fingerprint: "same-content",
      normalizedLength: 120,
      sourceStatus: 0,
      sourceFormat: "markdown",
      titleDerived: false,
      createdAt: "2024-01-01T00:00:00Z",
    },
    {
      conceptId: "/yuque/documents/1/2.md",
      kind: "document",
      fingerprint: "same-content",
      normalizedLength: 120,
      sourceStatus: 0,
      sourceFormat: "ymd",
      titleDerived: false,
      createdAt: "2025-01-01T00:00:00Z",
    },
    {
      conceptId: "/yuque/notes/10.md",
      kind: "note",
      fingerprint: "tiny",
      normalizedLength: 8,
      sourceStatus: 0,
      sourceFormat: "markdown",
      titleDerived: false,
      createdAt: "2023-01-01T00:00:00Z",
    },
  ], { minChars: 20 });

  assert.equal(plan.groups.length, 1);
  assert.equal(plan.groups[0].canonicalId, "/yuque/documents/1/2.md");
  assert.equal(plan.assignments.get("/yuque/notes/9.md").status, "duplicate");
  assert.equal(plan.assignments.get("/yuque/notes/9.md").duplicateOf, "/yuque/documents/1/2.md");
  assert.equal(plan.assignments.has("/yuque/notes/10.md"), false);
});

test("producer reports same-title concepts only when their bodies differ", () => {
  const groups = buildTitleCollisionGroups([
    { conceptId: "/yuque/documents/1/1.md", title: "接口 文档", fingerprint: "body-a" },
    { conceptId: "/yuque/documents/2/2.md", title: "接口文档", fingerprint: "body-b" },
    { conceptId: "/yuque/documents/3/3.md", title: "相同副本", fingerprint: "same" },
    { conceptId: "/yuque/documents/4/4.md", title: "相同副本", fingerprint: "same" },
    { conceptId: "/yuque/documents/5/5.md", title: "独立标题", fingerprint: "unique" },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].normalizedTitle, "接口文档");
  assert.deepEqual(groups[0].memberIds, [
    "/yuque/documents/1/1.md",
    "/yuque/documents/2/2.md",
  ]);
});

test("producer derives a useful title only for placeholder source titles", () => {
  assert.deepEqual(deriveConceptTitle({
    sourceTitle: "无标题",
    body: "# Agent 运行时设计\n\n后续正文",
    fallback: "语雀文档 42",
    placeholderTitles: ["无标题", "新建文档"],
  }), { title: "Agent 运行时设计", derived: true });

  assert.deepEqual(deriveConceptTitle({
    sourceTitle: "保留原题",
    body: "# 正文标题",
    fallback: "语雀文档 43",
    placeholderTitles: ["无标题", "新建文档"],
  }), { title: "保留原题", derived: false });
});

test("producer extracts semantic HTML headings and rejects machine markup as titles", () => {
  assert.deepEqual(deriveConceptTitle({
    sourceTitle: "",
    body: '<!doctype lake><meta name="doc-version" content="1" /><h4>修行</h4><p>把心放平。</p>',
    fallback: "语雀小记 16161",
  }), { title: "修行", derived: true });

  assert.deepEqual(deriveConceptTitle({
    sourceTitle: "无标题",
    body: '[{"format":"laketable","type":"Table","version":1.4}]',
    fallback: "语雀文档 42",
    placeholderTitles: ["无标题"],
  }), { title: "语雀文档 42", derived: false });

  assert.deepEqual(deriveConceptTitle({
    sourceTitle: "无标题",
    body: '<board-card src="board://abc" />',
    fallback: "语雀文档 43",
    placeholderTitles: ["无标题"],
  }), { title: "语雀文档 43", derived: false });

  assert.deepEqual(deriveConceptTitle({
    sourceTitle: "",
    body: "\u0000",
    fallback: "语雀小记 44",
  }), { title: "语雀小记 44", derived: false });

  assert.deepEqual(deriveConceptTitle({
    sourceTitle: "",
    body: "，60966966",
    fallback: "语雀小记 45",
  }), { title: "语雀小记 45", derived: false });

  assert.deepEqual(deriveConceptTitle({
    sourceTitle: "\u200b",
    body: "",
    fallback: "语雀小记 46",
  }), { title: "语雀小记 46", derived: false });

  assert.deepEqual(deriveConceptTitle({
    sourceTitle: "无标题",
    body: "```flowchart\nflowchart TD\nStart --> End\n```",
    fallback: "语雀文档 47",
    placeholderTitles: ["无标题"],
  }), { title: "语雀文档 47", derived: false });
});

test("producer separates empty, media, short-form, archived, and substantive knowledge", () => {
  const classify = (input) => classifyContent({
    kind: "note",
    hasMedia: false,
    sourceStatus: 0,
    shortFormChars: 100,
    ...input,
  });

  assert.equal(classify({ body: "" }).quality, "empty");
  assert.equal(classify({ body: "![架构图](asset.png)", hasMedia: true }).quality, "media-only");
  assert.equal(classify({ body: "记一下" }).quality, "short-form");
  assert.equal(classify({ body: "已经删除但仍保留证据", sourceStatus: 9 }).quality, "archived");
  assert.equal(classify({ body: "这是一段足够长的正式知识内容，用于进入主要索引。".repeat(5) }).quality, "substantive");
});

test("producer keeps resource URLs in exact identity but removes cards from text similarity", () => {
  const first = '<unknown-card cardName="bookmark" src="https://example.com/a" />';
  const second = '<unknown-card cardName="bookmark" src="https://example.com/b" />';

  assert.notEqual(normalizeExactContent(first), normalizeExactContent(second));
  assert.equal(normalizeContentForFingerprint(first), "");
  assert.equal(classifyContent({ kind: "document", body: first, hasMedia: true }).quality, "media-only");
  assert.equal(hasEmbeddedResource('<attachment-card src="file.xmind" />'), true);
  assert.equal(hasEmbeddedResource('<card type="block" name="bookmarklink" value="data:..." />'), true);
  assert.equal(hasEmbeddedResource("<p></p>"), false);
});

test("producer reports near duplicates without automatically collapsing them", () => {
  const shared = "Agent 运行时负责会话、工具调用、权限控制和事件记录。".repeat(12);
  const items = [
    { conceptId: "/yuque/documents/1/1.md", normalizedText: shared, fingerprint: "a" },
    { conceptId: "/yuque/documents/2/2.md", normalizedText: `${shared}补充一条部署说明。`, fingerprint: "b" },
    { conceptId: "/yuque/documents/3/3.md", normalizedText: "完全无关的足球训练记录。".repeat(20), fingerprint: "c" },
  ];

  const pairs = findNearDuplicatePairs(items, {
    minChars: 50,
    threshold: 0.8,
    shingleSize: 5,
    fingerprintSize: 32,
    minimumSharedFingerprints: 2,
  });

  assert.equal(pairs.length, 1);
  assert.deepEqual(pairs[0].conceptIds, [
    "/yuque/documents/1/1.md",
    "/yuque/documents/2/2.md",
  ]);
  assert.ok(pairs[0].similarity >= 0.8);
});

test("producer avoids repeating the concept title as the first body heading", () => {
  assert.equal(
    removeRedundantLeadingHeading("# Agent 运行时\n\n正文", "Agent 运行时"),
    "正文",
  );
  assert.equal(
    removeRedundantLeadingHeading("# 另一主题\n\n正文", "Agent 运行时"),
    "# 另一主题\n\n正文",
  );
});
