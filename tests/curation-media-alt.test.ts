import { describe, expect, it } from "vitest";

import { formatCurationMediaAlt } from "@/lib/curation-format";

describe("formatCurationMediaAlt", () => {
  it("identifies a single source image without inventing its contents", () => {
    expect(formatCurationMediaAlt("让 Agent 先澄清目标", 0, 1)).toBe(
      "让 Agent 先澄清目标，来源媒体第 1 张，共 1 张",
    );
  });

  it("gives each item in a mixed media set a distinct position", () => {
    expect([
      formatCurationMediaAlt("工具调用的可靠性", 0, 3),
      formatCurationMediaAlt("工具调用的可靠性", 1, 3),
      formatCurationMediaAlt("工具调用的可靠性", 2, 3),
    ]).toEqual([
      "工具调用的可靠性，来源媒体第 1 张，共 3 张",
      "工具调用的可靠性，来源媒体第 2 张，共 3 张",
      "工具调用的可靠性，来源媒体第 3 张，共 3 张",
    ]);
  });
});
