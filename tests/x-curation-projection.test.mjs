import assert from "node:assert/strict";
import test from "node:test";

import { publishQueueToSupabase } from "../modules/x-sync/publish-to-supabase.mjs";
import { isReadyForPublication, toPublicCurationItem } from "../modules/x-sync/curation-projection.mjs";
import { firstSeenMetadata, parseSourceOrderSnapshot } from "../modules/x-sync/source-order.mjs";

const item = {
  ai: {
    analysis: "解析",
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

test("only completed Pi results become a public curation record", () => {
  assert.equal(isReadyForPublication(item), true);
  assert.equal(isReadyForPublication({ ...item, ai: { ...item.ai, tags: [] } }), false);
  assert.deepEqual(toPublicCurationItem(item), {
    analysis: "解析",
    author: { handle: "author", name: "Author" },
    collectedAt: null,
    collectedOrder: null,
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
    summary: "摘要",
    tags: ["Agent 工程"],
    text: "公开原文",
    title: "标题",
    tweetUrl: "https://x.com/author/status/1",
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

test("Supabase publisher requires service credentials before accessing the network", async () => {
  await assert.rejects(
    publishQueueToSupabase({ items: [] }, {}),
    /SUPABASE_URL/u,
  );
});

test("publishing a public curation projection refreshes the daily Q&A index", async () => {
  const calls = [];
  const client = {
    from: () => ({ upsert: async () => ({ error: null }) }),
    rpc: async (name, arguments_) => {
      calls.push({ arguments_, name });
      return { data: 1, error: null };
    },
  };

  const result = await publishQueueToSupabase({ items: [item] }, {
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    SUPABASE_URL: "https://example.supabase.co",
  }, () => client);

  assert.equal(result.indexedCount, 1);
  assert.deepEqual(calls[0], {
    arguments_: {
      p_documents: [{
        content: "摘要\n\n解析\n\n公开原文",
        id: "daily:1",
        published_at: "2026-08-09T00:00:00.000Z",
        search_text: "标题\n\nAgent 工程\n\nAuthor\n\nauthor\n\n摘要\n\n解析\n\n公开原文",
        section: null,
        source_id: "1",
        source_scope: "daily",
        source_url: "/curation/1",
        title: "标题",
      }],
      p_replace_scope: false,
      p_scope: "daily",
    },
    name: "sync_ask_search_documents",
  });
});
