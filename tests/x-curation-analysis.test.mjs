import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCurationAnalysis,
  extractCurationFacts,
  hasReusableVisualFacts,
  needsCurationAnalysis,
  prepareCurationItem,
  recordCurationAnalysisFailure,
} from "../modules/x-sync/analysis.mjs";
import { buildCurationInsights, renderCurationInsightsMarkdown } from "../modules/x-sync/insights.mjs";

const rawItem = {
  ai: { analysis: "", enrichedAt: null, summary: "", tags: [], title: "" },
  author: { handle: "author", name: "Author" },
  createdAt: "2026-08-20T00:00:00.000Z",
  fetchSource: "bookmark+like",
  id: "1",
  isQuote: true,
  isReply: false,
  links: [{ expanded: "https://github.com/openai/codex", original: "https://t.co/one", type: "github" }],
  media: [{ type: "photo", url: "https://pbs.twimg.com/media/one.jpg" }],
  quoteContext: { author: "quoted", authorName: "Quoted", text: "Try @OpenAI #Agents" },
  replyContext: null,
  text: "A useful #Agent workflow with @github",
  tweetUrl: "https://x.com/author/status/1",
};

test("analysis preparation extracts deterministic facts and creates resumable stages", () => {
  const prepared = prepareCurationItem(rawItem, { now: "2026-08-21T00:00:00.000Z" });

  assert.deepEqual(extractCurationFacts(rawItem), {
    version: 1,
    contentType: "quote",
    domains: ["github.com"],
    hashtags: ["agent", "agents"],
    linkTypes: ["github"],
    mediaTypes: ["photo"],
    mentions: ["github", "openai"],
    sourceKinds: ["bookmark", "like"],
    tools: ["GitHub"],
  });
  assert.equal(prepared.pipeline.stages.facts.status, "complete");
  assert.equal(needsCurationAnalysis(prepared), true);
});

test("editorial analysis persists bounded search and visual facts for reuse", () => {
  const analyzed = applyCurationAnalysis(rawItem, {
    analysis: "深度解析",
    design: { categories: [], confidence: 0.8, evidence: ["证据"], reason: "原因", relevant: false, status: "exclude" },
    searchSignals: {
      concepts: ["Agent 工作流"],
      entities: ["OpenAI"],
      problems: ["登录态复用"],
      sentiment: "positive",
      tools: ["Codex"],
      useCases: ["网页操作"],
    },
    summary: "摘要",
    tags: ["Agent 工程"],
    title: "标题",
    visualFacts: {
      interactionSignals: ["命令面板"],
      objects: ["终端"],
      ocr: ["codex"],
      scenes: ["代码编辑器"],
      styles: ["ui"],
      tools: ["Codex"],
    },
  }, {
    completedAt: "2026-08-21T00:00:00.000Z",
    model: "codex-cli/gpt-test",
    visualEvidenceCount: 1,
  });

  assert.equal(needsCurationAnalysis(analyzed), false);
  assert.equal(hasReusableVisualFacts(analyzed), true);
  assert.deepEqual(analyzed.ai.searchSignals.concepts, ["Agent 工作流"]);
  assert.deepEqual(analyzed.ai.visualFacts.ocr, ["codex"]);
  assert.equal(analyzed.pipeline.stages.editorial.version, 2);
  assert.equal(needsCurationAnalysis(analyzed, { refresh: true }), false);
  assert.equal(needsCurationAnalysis(prepareCurationItem({ ...analyzed, text: "source changed" })), true);
});

test("refresh selects legacy analysis once and skips it after the Codex stage is current", () => {
  const legacy = prepareCurationItem({
    ...rawItem,
    ai: { analysis: "旧解析", enrichedAt: "2026-08-20T00:00:00.000Z", summary: "旧摘要", tags: ["Agent 工程"], title: "旧标题" },
  });

  assert.equal(needsCurationAnalysis(legacy), false);
  assert.equal(needsCurationAnalysis(legacy, { refresh: true }), true);
});

test("failed analysis remains retryable with an explicit error state", () => {
  const failed = recordCurationAnalysisFailure(rawItem, new Error("model unavailable"), {
    attemptedAt: "2026-08-21T00:00:00.000Z",
    model: "pi/test",
  });

  assert.equal(failed.pipeline.stages.editorial.status, "error");
  assert.equal(failed.pipeline.stages.editorial.attempts, 1);
  assert.equal(needsCurationAnalysis(failed), true);
});

test("private insights summarize corpus health, source mix, tools, and emerging topics", () => {
  const analyzed = applyCurationAnalysis(rawItem, {
    analysis: "解析",
    design: { categories: [], confidence: 0.8, evidence: [], reason: "原因", relevant: false, status: "exclude" },
    searchSignals: { concepts: ["Agent 工作流"], tools: ["Codex"] },
    summary: "摘要",
    tags: ["Agent 工程"],
    title: "标题",
  }, { completedAt: "2026-08-21T00:00:00.000Z", model: "test" });
  const second = {
    ...analyzed,
    id: "2",
    pipeline: { ...analyzed.pipeline, inputHash: "different" },
  };
  const insights = buildCurationInsights([analyzed, second], { generatedAt: "2026-08-29T00:00:00.000Z" });

  assert.equal(insights.totals.items, 2);
  assert.deepEqual(insights.topTools[0], { count: 2, name: "Codex" });
  assert.deepEqual(insights.emergingTopics[0], { count: 2, name: "Agent 工作流", previousCount: 0 });
  assert.deepEqual(insights.sourceMix, [
    { count: 2, name: "bookmark" },
    { count: 2, name: "like" },
  ]);
  assert.match(renderCurationInsightsMarkdown(insights), /## 上升主题/u);
});
