import { describe, expect, it } from "vitest";

import { searchAskDocuments } from "@/lib/ask-search.server";
import type { AskDocumentScope } from "@/lib/ask-types";

const cases: Array<{ expectedId: RegExp; query: string; scope: AskDocumentScope }> = [
  { expectedId: /^profile:about$/u, query: "十余年项目开发经验", scope: "profile" },
  { expectedId: /^profile:about$/u, query: "陈远关心 AI 如何进入真实工作", scope: "profile" },
  { expectedId: /^works:waker:/u, query: "Waker 长周期 Agent 工作流", scope: "works" },
  { expectedId: /^works:pi-samples:/u, query: "Pi Coding Agent Web Workbench", scope: "works" },
  { expectedId: /^works:personal-sites:/u, query: "ISR 缓存与性能优化", scope: "works" },
  { expectedId: /^daily:209(?:3370341418582346|2929366590112088|0966813563654608|0942603365953778)$/u, query: "Skill Doctor 历史对话", scope: "daily" },
  { expectedId: /^daily:2093368761877504038$/u, query: "OpenMontage 视频制片厂", scope: "daily" },
  { expectedId: /^daily:2093256524521201666$/u, query: "本地 HTTPS 域名", scope: "daily" },
  { expectedId: /^open-source:pdf-inspector:/u, query: "PDF 选择性 OCR", scope: "open-source" },
  { expectedId: /^open-source:microsoft-skill-recorder:/u, query: "记录桌面操作生成 Skill", scope: "open-source" },
];

describe("Ask public retrieval quality", () => {
  it.each(cases)("finds the expected source for $query", async ({ expectedId, query, scope }) => {
    const sources = await searchAskDocuments(query, scope);
    expect(
      sources.slice(0, 3).some(({ id }) => expectedId.test(id)),
      `top sources: ${sources.slice(0, 3).map(({ id }) => id).join(", ")}`,
    ).toBe(true);
  });
});
