import { describe, expect, it, vi } from "vitest";

// lib/curation 顶部 import "server-only" 只面向 RSC 边界；测试里替换为空实现。
vi.mock("server-only", () => ({}));

const { getCurationNeighbors, getCurationPage, getDouyinCurationPage } = await import("../lib/curation");
const { GET } = await import("../app/api/douyin/route");

// 集成测试直接读随仓库打包的公开投影 data/curation.sqlite（当前含 5 条抖音条目）。
describe("douyin curation split", () => {
  it("每日关注分页只返回 X 来源条目", async () => {
    const page = await getCurationPage(0, 50);
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((item) => item.source.platform === "x")).toBe(true);
  });

  it("抖音收藏分页只返回抖音来源条目", async () => {
    const page = await getDouyinCurationPage(0, 50);
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((item) => item.source.platform === "douyin")).toBe(true);
    // 条目数随同步与发布增长，不硬编码具体数量。
  });

  it("相邻条目导航不跨来源", async () => {
    const douyinPage = await getDouyinCurationPage(0, 50);
    for (const item of douyinPage.items) {
      const neighbors = await getCurationNeighbors(item.id);
      for (const neighbor of [neighbors.newer, neighbors.older]) {
        if (neighbor) expect(neighbor.id.startsWith("douyin-")).toBe(true);
      }
    }

    const xPage = await getCurationPage(0, 5);
    for (const item of xPage.items) {
      const neighbors = await getCurationNeighbors(item.id);
      for (const neighbor of [neighbors.newer, neighbors.older]) {
        if (neighbor) expect(neighbor.id.startsWith("douyin-")).toBe(false);
      }
    }
  });

  it("未知条目的相邻导航返回空", async () => {
    expect(await getCurationNeighbors("missing-id")).toEqual({ newer: null, older: null });
  });

  it("/api/douyin 只返回抖音条目并带公开缓存头", async () => {
    const response = await GET(new Request("http://localhost/api/douyin?offset=0&limit=20"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=300");
    const payload = await response.json();
    expect(payload.items.length).toBeGreaterThan(0);
    expect(payload.items.every((item: { source: { platform: string } }) => item.source.platform === "douyin")).toBe(true);
  });

  it("/api/douyin 拒绝非法分页参数", async () => {
    const response = await GET(new Request("http://localhost/api/douyin?offset=-1"));
    expect(response.status).toBe(400);
  });
});
