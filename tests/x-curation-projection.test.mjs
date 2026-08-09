import assert from "node:assert/strict";
import test from "node:test";

import { publishQueueToSupabase } from "../modules/x-sync/publish-to-supabase.mjs";
import { isReadyForPublication, toPublicCurationItem } from "../modules/x-sync/curation-projection.mjs";

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

test("Supabase publisher requires service credentials before accessing the network", async () => {
  await assert.rejects(
    publishQueueToSupabase({ items: [] }, {}),
    /SUPABASE_URL/u,
  );
});
