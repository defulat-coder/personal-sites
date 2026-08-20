import { describe, expect, it } from "vitest";

import {
  fromAiNewsStreamSnapshot,
  toAiNewsStreamSnapshot,
} from "../components/ai-news-stream-snapshot";
import type { AiNewsListItem } from "../lib/ai-news-types";

const sampleItem: AiNewsListItem = {
  category: "ai-models",
  id: "cmssv94cg0h4mroffsb9e7a88",
  publishedAt: "2026-08-14T11:25:29.000Z",
  selected: true,
  sourceName: "公众号：小红书技术（dots.llm）",
  summary: "小红书技术开源 dots3-note Preview。",
  title: "dots3-note Preview 开源",
};

function serialize(itemCount: number, overrides: Partial<Parameters<typeof toAiNewsStreamSnapshot>[0]> = {}) {
  const items = Array.from({ length: itemCount }, (_, index) => ({
    ...sampleItem,
    id: index === 0 ? sampleItem.id : `item-${index}`,
  }));
  return JSON.stringify(toAiNewsStreamSnapshot({
    activeCategory: null,
    hasMore: true,
    items,
    scrollTop: 0,
    ...overrides,
  }));
}

describe("ai news stream snapshot", () => {
  it("round-trips items, pagination and filter state", () => {
    const raw = serialize(3, { activeCategory: "selected", hasMore: false, scrollTop: 640 });
    const snapshot = fromAiNewsStreamSnapshot(raw, sampleItem.id);
    expect(snapshot).toMatchObject({
      activeCategory: "selected",
      hasMore: false,
      scrollTop: 640,
    });
    expect(snapshot?.items).toHaveLength(3);
  });

  it("rejects snapshots whose head no longer matches the SSR head", () => {
    const raw = serialize(2);
    expect(fromAiNewsStreamSnapshot(raw, "a-newer-item-id")).toBeNull();
  });

  it("rejects expired snapshots", () => {
    const savedAt = 1_000_000;
    const raw = JSON.stringify(toAiNewsStreamSnapshot({
      activeCategory: null,
      hasMore: true,
      items: [sampleItem],
      scrollTop: 0,
    }, savedAt));
    expect(fromAiNewsStreamSnapshot(raw, sampleItem.id, savedAt + 29 * 60 * 1000)).not.toBeNull();
    expect(fromAiNewsStreamSnapshot(raw, sampleItem.id, savedAt + 31 * 60 * 1000)).toBeNull();
  });

  it("caps stored items to bound sessionStorage size", () => {
    const raw = serialize(500);
    const snapshot = fromAiNewsStreamSnapshot(raw, sampleItem.id);
    expect(snapshot?.items).toHaveLength(400);
  });

  it("rejects missing, malformed or empty snapshots", () => {
    expect(fromAiNewsStreamSnapshot(null, sampleItem.id)).toBeNull();
    expect(fromAiNewsStreamSnapshot("not-json", sampleItem.id)).toBeNull();
    expect(fromAiNewsStreamSnapshot(JSON.stringify({ items: [] }), sampleItem.id)).toBeNull();
    expect(fromAiNewsStreamSnapshot(serialize(1), undefined)).toBeNull();
  });
});
