import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSyncRows, fetchFeed, stripEmoji, syncAiNews, toPublicAiNewsItem } from "../modules/ai-news/sync.mjs";

const upstreamItem = {
  category: "ai-models",
  id: "cmssv94cg0h4mroffsb9e7a88",
  links: {
    aihot: "https://upstream.example/items/cmssv94cg0h4mroffsb9e7a88",
    original: "https://mp.weixin.qq.com/s/example",
  },
  publishedAt: "2026-08-14T11:25:29.000Z",
  reason: "长程智能体方向值得关注。",
  score: 79,
  source: { name: "公众号：小红书技术（dots.llm）" },
  summary: "小红书技术开源 dots3-note Preview。",
  title: "dots3-note Preview 开源",
};

describe("ai news sync", () => {
  it("projects upstream items to public content without upstream links", () => {
    assert.deepEqual(toPublicAiNewsItem(upstreamItem), {
      category: "ai-models",
      id: "cmssv94cg0h4mroffsb9e7a88",
      publishedAt: "2026-08-14T11:25:29.000Z",
      reason: "长程智能体方向值得关注。",
      score: 79,
      sourceName: "公众号：小红书技术（dots.llm）",
      summary: "小红书技术开源 dots3-note Preview。",
      title: "dots3-note Preview 开源",
      url: "https://mp.weixin.qq.com/s/example",
    });
  });

  it("drops items without an original link or title from the public projection", () => {
    assert.equal(toPublicAiNewsItem({ ...upstreamItem, links: {} }), null);
    assert.equal(toPublicAiNewsItem({ ...upstreamItem, title: "" }), null);
    assert.equal(toPublicAiNewsItem(null), null);
  });

  it("normalizes missing optional fields", () => {
    const item = toPublicAiNewsItem({
      id: "x",
      links: { original: "https://x.com/example" },
      summary: null,
      title: "只有标题",
    });
    assert.equal(item.summary, "");
    assert.equal(item.reason, "");
    assert.equal(item.score, null);
    assert.equal(item.publishedAt, null);
  });

  it("builds private and public rows, marking the selected feed", () => {
    const { privateRows, publicRows } = buildSyncRows([upstreamItem], "selected", "2026-08-14T13:00:00.000Z");
    assert.equal(privateRows.length, 1);
    assert.deepEqual(privateRows[0].feeds, ["selected"]);
    assert.equal(privateRows[0].raw_payload.id, upstreamItem.id);
    assert.equal(privateRows[0].synced_at, "2026-08-14T13:00:00.000Z");
    assert.equal(publicRows.length, 1);
    assert.equal(publicRows[0].selected, true);
    assert.equal(publicRows[0].content.url, "https://mp.weixin.qq.com/s/example");

    const allFeed = buildSyncRows([upstreamItem], "all", "2026-08-14T13:00:00.000Z");
    assert.equal(allFeed.publicRows[0].selected, false);
  });

  it("keeps non-public items out of the public rows but in the private backup", () => {
    const noOriginal = { ...upstreamItem, id: "no-original", links: {} };
    const { privateRows, publicRows } = buildSyncRows([noOriginal], "all", "2026-08-14T13:00:00.000Z");
    assert.equal(privateRows.length, 1);
    assert.equal(publicRows.length, 0);
  });

  it("fetchFeed paginates with page.nextCursor until hasMore is false", async () => {
    const requested = [];
    const fetchImpl = async (url) => {
      requested.push(url);
      const cursor = new URL(url).searchParams.get("cursor");
      if (!cursor) {
        return new Response(JSON.stringify({
          items: [{ id: "a" }],
          page: { count: 1, hasMore: true, nextCursor: "cursor-2" },
        }), { headers: { etag: "W/\"v1\"" }, status: 200 });
      }
      assert.equal(cursor, "cursor-2");
      return new Response(JSON.stringify({
        items: [{ id: "b" }],
        page: { count: 1, hasMore: false, nextCursor: null },
      }), { status: 200 });
    };
    const feed = await fetchFeed("all", { fetchImpl, window: "7d" });
    assert.equal(feed.changed, true);
    assert.deepEqual(feed.items.map((item) => item.id), ["a", "b"]);
    assert.equal(feed.etag, "W/\"v1\"");
    assert.equal(requested.length, 2);
    assert.match(requested[0], /window=7d/);
  });

  it("fetchFeed short-circuits on 304 with the stored etag", async () => {
    const seen = [];
    const fetchImpl = async (url, init) => {
      seen.push(init.headers["if-none-match"]);
      return new Response(null, { status: 304 });
    };
    const feed = await fetchFeed("selected", { etag: "W/\"old\"", fetchImpl });
    assert.deepEqual(feed, { changed: false, items: [] });
    assert.deepEqual(seen, ["W/\"old\""]);
  });

  it("strips leftover emoji from upstream copy in the public projection", () => {
    assert.equal(stripEmoji("发布新模型 🚀🎉 性能提升 ⚡️"), "发布新模型 性能提升");
    assert.equal(stripEmoji("持续增长 📈。下一步：扩大访问"), "持续增长。下一步：扩大访问");
    assert.equal(stripEmoji("没有 emoji 的文本"), "没有 emoji 的文本");
    const item = toPublicAiNewsItem({ ...upstreamItem, summary: "开源新模型 ✨，性能提升 50% 🎉" });
    assert.equal(item.summary, "开源新模型，性能提升 50%");
  });

  it("syncAiNews resets stale selected flags before marking the current feed", async () => {
    const makeItem = (id) => ({ ...upstreamItem, id, links: { original: `https://example.com/${id}` } });
    const feedByMode = {
      all: [makeItem("fresh-z")],
      selected: [makeItem("keep-x"), makeItem("fresh-z")],
    };
    const fetchImpl = async (url) => {
      const mode = new URL(url).searchParams.get("mode");
      return new Response(JSON.stringify({
        items: feedByMode[mode],
        page: { count: feedByMode[mode].length, hasMore: false, nextCursor: null },
      }), { status: 200 });
    };

    // 内存版公开投影：stale-y 是已掉出精选 feed 且不在本轮 24h 窗口里的旧精选。
    const store = new Map([
      ["keep-x", { id: "keep-x", selected: false }],
      ["stale-y", { id: "stale-y", selected: true }],
    ]);
    const fakeTable = {
      select: () => ({
        eq: async (column, value) => ({
          data: [...store.values()].filter((row) => row[column] === value).map((row) => ({ id: row.id })),
          error: null,
        }),
      }),
      upsert: async (rows) => {
        for (const row of rows) store.set(row.id, { ...store.get(row.id), ...row });
        return { error: null };
      },
      update: (patch) => ({
        eq: (column, value) => ({
          not: async (_column, _op, listLiteral) => {
            const excluded = new Set(listLiteral.replace(/^\(|\)$/g, "").split(",").filter(Boolean));
            for (const row of store.values()) {
              if (row[column] === value && !excluded.has(row.id)) Object.assign(row, patch);
            }
            return { error: null };
          },
        }),
        in: async (_column, ids) => {
          for (const id of ids) {
            const row = store.get(id);
            if (row) Object.assign(row, patch);
          }
          return { error: null };
        },
      }),
      delete: () => ({ or: async () => ({ error: null }) }),
    };
    const clientFactory = () => ({ from: () => fakeTable });

    await syncAiNews({
      backfill: true,
      clientFactory,
      env: { SUPABASE_SERVICE_ROLE_KEY: "test", SUPABASE_URL: "https://example.supabase.co" },
      fetchImpl,
      repoRoot: "/tmp/unused-in-backfill",
    });

    assert.equal(store.get("stale-y").selected, false, "掉出精选 feed 的旧条目必须复位");
    assert.equal(store.get("keep-x").selected, true);
    assert.equal(store.get("fresh-z").selected, true);
  });
});
