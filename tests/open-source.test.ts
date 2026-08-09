import { describe, expect, it } from "vitest";

import {
  getOpenSourceEntry,
  openSourceCategories,
  openSourceEntries,
} from "../lib/open-source";

describe("open-source curation", () => {
  it("only exposes a curated public subset with stable, unique routes", () => {
    expect(openSourceEntries).toHaveLength(10);
    expect(new Set(openSourceEntries.map((entry) => entry.slug)).size).toBe(openSourceEntries.length);
    expect(openSourceEntries.every((entry) => entry.repositoryUrl.startsWith("https://github.com/"))).toBe(true);
  });

  it("keeps skills and agent systems as distinct primary categories", () => {
    expect(openSourceCategories.map((category) => category.id)).toEqual([
      "all",
      "skills",
      "agents",
      "context",
      "tools",
    ]);
    expect(openSourceEntries.some((entry) => entry.category === "skills")).toBe(true);
    expect(openSourceEntries.some((entry) => entry.category === "agents")).toBe(true);
  });

  it("looks up a curated item without exposing an unbounded GitHub Star list", () => {
    expect(getOpenSourceEntry("herdr")).toMatchObject({
      repository: "herdrdev/herdr",
      category: "agents",
    });
    expect(getOpenSourceEntry("not-starred")).toBeNull();
  });
});
