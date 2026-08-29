import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { isReadyForPublication, toPublicCurationItem } from "../modules/x-sync/curation-projection.mjs";
import { buildPublicCurationDatabase } from "../modules/focus-sync/public-sqlite.mjs";
import { firstSeenMetadata, parseSourceOrderSnapshot } from "../modules/x-sync/source-order.mjs";

const item = {
  ai: {
    analysis: "解析",
    design: {
      categories: ["交互设计"],
      classifiedAt: "2026-08-09T00:00:00.000Z",
      confidence: 0.91,
      evidence: ["视频展示界面交互"],
      reason: "主要价值来自交互设计。",
      relevant: true,
      status: "include",
    },
    enrichedAt: "2026-08-09T00:00:00.000Z",
    summary: "摘要",
    tags: ["Agent 工程"],
    title: "标题",
  },
  author: { handle: "author", name: "Author" },
  createdAt: "2026-08-09T00:00:00.000Z",
  id: "1",
  isQuote: false,
  links: [{ expanded: "https://example.com", original: "https://t.co/x", type: "article" }],
  media: [{
    durationMs: 12_000,
    height: 720,
    previewUrl: "https://pbs.twimg.com/media/preview.jpg",
    type: "video",
    url: "https://pbs.twimg.com/media/cover.jpg",
    videoUrl: "https://video.twimg.com/video.mp4",
    width: 1280,
  }],
  text: "公开原文",
  tweetUrl: "https://x.com/author/status/1",
};

test("only completed analysis results become a public curation record", () => {
  assert.equal(isReadyForPublication(item), true);
  assert.equal(isReadyForPublication({ ...item, ai: { ...item.ai, tags: [] } }), false);
  assert.deepEqual(toPublicCurationItem(item), {
    analysis: "解析",
    author: { handle: "author", name: "Author" },
    collectedAt: null,
    collectedOrder: null,
    design: item.ai.design,
    facts: {
      contentType: "original",
      domains: ["example.com"],
      hashtags: [],
      linkTypes: ["article"],
      mediaTypes: ["video"],
      mentions: [],
      sourceKinds: [],
      tools: [],
      version: 1,
    },
    id: "1",
    links: [{ shortUrl: "https://t.co/x", type: "article", url: "https://example.com" }],
    media: [{
      durationMs: 12_000,
      height: 720,
      previewUrl: "https://pbs.twimg.com/media/preview.jpg",
      type: "video",
      url: "https://pbs.twimg.com/media/cover.jpg",
      videoUrl: "https://video.twimg.com/video.mp4",
      width: 1280,
    }],
    publishedAt: "2026-08-09T00:00:00.000Z",
    quoteContext: null,
    searchSignals: null,
    summary: "摘要",
    tags: ["Agent 工程"],
    text: "公开原文",
    title: "标题",
    visualFacts: null,
    source: { label: "X 原文", platform: "x", url: "https://x.com/author/status/1" },
  });
});

test("the public projection retains first-seen time and X list position for feed ordering", () => {
  const projected = toPublicCurationItem({
    ...item,
    firstSeenAt: "2026-08-10T07:24:00.000Z",
    firstSeenOrder: 3,
  });

  assert.equal(projected.collectedAt, "2026-08-10T07:24:00.000Z");
  assert.equal(projected.collectedOrder, 3);
});

test("only items present in the X snapshot receive its collection time and list position", () => {
  const sourceOrder = parseSourceOrderSnapshot({
    capturedAt: "2026-08-10T07:24:00.000Z",
    ids: Array.from({ length: 20 }, (_, index) => `x-${index}`),
    source: "bookmarks",
  }, "bookmarks");

  assert.deepEqual(
    firstSeenMetadata({ itemId: "x-19", sourceOrder }),
    { firstSeenAt: "2026-08-10T07:24:00.000Z", firstSeenOrder: 19 },
  );
  assert.deepEqual(
    ["backlog-1", "backlog-2", "backlog-3", "backlog-4", "backlog-5", "x-0"].map((itemId) =>
      firstSeenMetadata({ itemId, sourceOrder })),
    [null, null, null, null, null, {
      firstSeenAt: "2026-08-10T07:24:00.000Z",
      firstSeenOrder: 0,
    }],
  );
  assert.throws(
    () => parseSourceOrderSnapshot({ capturedAt: "2026-08-10T07:24:00.000Z", ids: [], source: "likes" }, "bookmarks"),
    /来源不匹配/u,
  );
});

test("public SQLite merges approved focus sources and builds the matching local Q&A index", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "curation-sqlite-test-"));
  const databasePath = path.join(directory, "curation.sqlite");
  try {
    const xItem = toPublicCurationItem(item);
    const douyinItem = {
      ...xItem,
      collectedAt: "2026-08-11T00:00:00.000Z",
      id: "douyin-2",
      source: { label: "抖音视频", platform: "douyin", url: "https://www.douyin.com/video/2" },
      title: "抖音条目",
    };
    const result = await buildPublicCurationDatabase({
      outputPath: databasePath,
      items: [xItem, douyinItem],
    });
    assert.deepEqual(result, { documentCount: 2, itemCount: 2 });

    const database = new Database(databasePath, { fileMustExist: true, readonly: true });
    assert.deepEqual(database.prepare("SELECT id, title FROM curation_items ORDER BY id").all(), [
      { id: "1", title: "标题" },
      { id: "douyin-2", title: "抖音条目" },
    ]);
    assert.deepEqual(database.prepare("SELECT id, source_url FROM ask_documents WHERE source_scope = 'daily' ORDER BY id").all(), [
      { id: "daily:1", source_url: "/curation/1" },
      { id: "daily:douyin-2", source_url: "/curation/douyin-2" },
    ]);
    assert.deepEqual(
      database.prepare("SELECT documents.id FROM ask_documents_fts JOIN ask_documents AS documents ON documents.rowid = ask_documents_fts.rowid WHERE ask_documents_fts MATCH '公开原文'").all(),
      [{ id: "daily:douyin-2" }, { id: "daily:1" }],
    );
    database.close();
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
