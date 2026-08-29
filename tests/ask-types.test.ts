import { describe, expect, it } from "vitest";

import { isAskScope } from "@/lib/ask-types";

describe("isAskScope", () => {
  it.each(["all", "profile", "works", "ai-news", "daily", "open-source"])("accepts %s", (scope) => {
    expect(isAskScope(scope)).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isAskScope("private")).toBe(false);
  });
});
