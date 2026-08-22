import { describe, expect, it, vi } from "vitest";

import { GET } from "../app/api/curation/[id]/route";

vi.mock("../lib/curation", () => ({
  findCurationItem: vi.fn(),
}));

const { findCurationItem } = await import("../lib/curation");
const findCurationItemMock = vi.mocked(findCurationItem);

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("curation detail route", () => {
  it("returns the full curation item with public cache headers", async () => {
    findCurationItemMock.mockResolvedValue({
      analysis: "# 分析",
      author: { handle: "someone", name: "Someone" },
      collectedAt: "2026-08-01T00:00:00.000Z",
      collectedOrder: 1,
      id: "abc123",
      links: [],
      media: [],
      publishedAt: "2026-08-01T01:00:00.000Z",
      quoteContext: null,
      summary: "摘要",
      tags: ["ai"],
      text: "原文",
      title: "标题",
      tweetUrl: "https://x.com/someone/status/1",
    });

    const response = await GET(new Request("http://localhost/api/curation/abc123"), context("abc123"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    expect(await response.json()).toMatchObject({ id: "abc123", title: "标题" });
  });

  it("returns 404 when the item does not exist", async () => {
    findCurationItemMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/curation/missing"), context("missing"));

    expect(response.status).toBe(404);
  });

  it("returns 500 without leaking internals when the read fails", async () => {
    findCurationItemMock.mockRejectedValue(new Error("sqlite exploded"));

    const response = await GET(new Request("http://localhost/api/curation/abc123"), context("abc123"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "暂时无法加载策展详情。" });
  });
});
