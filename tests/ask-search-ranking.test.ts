import { describe, expect, it } from "vitest";

import { fuseAskSearchDocuments } from "@/lib/ask-search.server";

const document = (id: string, score = 1) => ({
  content: id,
  id,
  publishedAt: null,
  score,
  scope: "daily" as const,
  section: null,
  sourceId: id,
  sourceUrl: `/curation/${id}`,
  title: id,
});

describe("fuseAskSearchDocuments", () => {
  it("rewards documents found by both exact and fallback retrieval", () => {
    const results = fuseAskSearchDocuments([
      { documents: [document("exact"), document("shared")], weight: 2 },
      { documents: [document("shared"), document("fallback")] },
    ]);
    expect(results.map(({ id }) => id)).toEqual(["shared", "exact", "fallback"]);
  });

  it("normalizes incompatible source scores by rank", () => {
    const results = fuseAskSearchDocuments([
      { documents: [document("local", 1)] },
      { documents: [document("remote", 1_000)] },
    ]);
    expect(results.map(({ id }) => id)).toEqual(["remote", "local"]);
    expect(results.every(({ score }) => score === 1)).toBe(true);
  });
});
