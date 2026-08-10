import { describe, expect, it } from "vitest";

import { getAskSearchFallbackTerms } from "@/lib/ask-search-terms";

describe("getAskSearchFallbackTerms", () => {
  it("drops question filler while retaining technical and Chinese search terms", () => {
    expect(getAskSearchFallbackTerms("最近有哪些关于 Agent 长期运行的实践？"))
      .toEqual(["Agent", "长期", "运行"]);
  });

  it("keeps a named technical term from an informal query", () => {
    expect(getAskSearchFallbackTerms("给我查一下那个 Codex 相关的内容"))
      .toEqual(["Codex"]);
  });
});
