import { describe, expect, it } from "vitest";

import {
  fromCurationStreamSnapshot,
  toCurationStreamSnapshot,
} from "../components/curation-stream-snapshot";
import type { CurationListItem } from "../lib/curation-types";

const sampleItem: CurationListItem = {
  attachments: [],
  author: { handle: "someone", name: "Someone" },
  collectedAt: "2026-08-14T11:25:29.000Z",
  id: "tweet-1",
  publishedAt: "2026-08-14T11:25:29.000Z",
  source: { label: "X 原文", platform: "x", url: "https://x.com/someone/status/1" },
  summary: "一条策展判断。",
  tags: [],
  text: "原推正文。",
  title: "策展标题",
};

function serialize(itemCount: number, overrides: Partial<Parameters<typeof toCurationStreamSnapshot>[0]> = {}) {
  const items = Array.from({ length: itemCount }, (_, index) => ({
    ...sampleItem,
    id: index === 0 ? sampleItem.id : `item-${index}`,
  }));
  return JSON.stringify(toCurationStreamSnapshot({
    hasMore: true,
    items,
    scrollTop: 0,
    ...overrides,
  }));
}

describe("curation stream snapshot", () => {
  it("round-trips items and pagination state", () => {
    const raw = serialize(3, { hasMore: false, scrollTop: 640 });
    const snapshot = fromCurationStreamSnapshot(raw, sampleItem.id);
    expect(snapshot).toMatchObject({
      hasMore: false,
      scrollTop: 640,
    });
    expect(snapshot?.items).toHaveLength(3);
  });

  it("rejects snapshots whose head no longer matches the SSR head", () => {
    const raw = serialize(2);
    expect(fromCurationStreamSnapshot(raw, "a-newer-item-id")).toBeNull();
  });

  it("rejects expired snapshots", () => {
    const savedAt = 1_000_000;
    const raw = JSON.stringify(toCurationStreamSnapshot({
      hasMore: true,
      items: [sampleItem],
      scrollTop: 0,
    }, savedAt));
    expect(fromCurationStreamSnapshot(raw, sampleItem.id, savedAt + 29 * 60 * 1000)).not.toBeNull();
    expect(fromCurationStreamSnapshot(raw, sampleItem.id, savedAt + 31 * 60 * 1000)).toBeNull();
  });

  it("caps stored items to bound sessionStorage size", () => {
    const raw = serialize(500);
    const snapshot = fromCurationStreamSnapshot(raw, sampleItem.id);
    expect(snapshot?.items).toHaveLength(400);
  });

  it("rejects missing, malformed or empty snapshots", () => {
    expect(fromCurationStreamSnapshot(null, sampleItem.id)).toBeNull();
    expect(fromCurationStreamSnapshot("not-json", sampleItem.id)).toBeNull();
    expect(fromCurationStreamSnapshot(JSON.stringify({ items: [] }), sampleItem.id)).toBeNull();
    expect(fromCurationStreamSnapshot(serialize(1), undefined)).toBeNull();
  });
});
