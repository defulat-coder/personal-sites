import assert from "node:assert/strict";
import test from "node:test";

import {
  splitReadmeByHeading,
  toDailySearchDocuments,
  toOpenSourceSearchDocuments,
  toProfileSearchDocument,
  toProjectSearchDocuments,
} from "../modules/ask/search-index.mjs";

test("profile and project records become first-class Ask documents", () => {
  const profile = toProfileSearchDocument();
  const works = toProjectSearchDocuments([{
    published_at: "2026-08-10T00:00:00.000Z",
    snapshot: {
      currentFocus: "可靠同步",
      period: "2026",
      projectId: "personal-site",
      records: [{
        bodyMarkdown: "使用租约避免重复执行。",
        id: "cron",
        kind: "practice",
        status: "active",
        summary: "Supabase Cron 每五分钟同步。",
        title: "可靠定时同步",
        topics: ["Supabase", "Cron"],
        updatedAt: "2026-08-10T00:00:00.000Z",
      }],
      role: "个人项目",
      slug: "personal-site",
      stack: ["Next.js", "Supabase"],
      status: "active",
      summary: "运行中的工程档案。",
      title: "个人网站",
    },
  }]);

  assert.equal(profile.source_scope, "profile");
  assert.match(profile.search_text, /十余年/u);
  assert.deepEqual(works.map((document) => document.id), [
    "works:personal-site:overview",
    "works:personal-site:cron",
  ]);
  assert.match(works[1].search_text, /Supabase Cron/u);
});

test("daily public projections become one searchable document per item", () => {
  const [document] = toDailySearchDocuments([{
    content: {
      analysis: "分析内容",
      author: { handle: "cy", name: "陈远" },
      facts: { domains: ["github.com"], hashtags: ["agents"], mentions: [], tools: ["GitHub"] },
      id: "tweet-1",
      publishedAt: "2026-08-10T00:00:00.000Z",
      summary: "摘要内容",
      tags: ["Agent", "检索"],
      text: "公开原文",
      title: "全文检索实践",
      searchSignals: { concepts: ["浏览器自动化"], entities: [], problems: ["登录态复用"], tools: ["Playwright"], useCases: [] },
      visualFacts: { interactionSignals: ["命令面板"], objects: [], ocr: ["Connect Chrome"], scenes: [], tools: [], styles: [] },
    },
  }]);

  assert.equal(document.id, "daily:tweet-1");
  assert.equal(document.source_url, "/curation/tweet-1");
  assert.match(document.search_text, /陈远/u);
  assert.match(document.search_text, /Agent/u);
  assert.match(document.search_text, /Connect Chrome/u);
  assert.match(document.search_text, /登录态复用/u);
  assert.match(document.content, /公开原文/u);
});

test("published README is split at headings and has stable source citations", () => {
  const sections = splitReadmeByHeading("# 安装\n\n第一段。\n\n## 使用\n\n第二段。");
  assert.deepEqual(sections.map(({ heading }) => heading), ["安装", "使用"]);

  const documents = toOpenSourceSearchDocuments([{
    content: {
      category: "agents",
      dimensions: ["agent-runtime"],
      parsedMarkdown: "# 安装\n\n第一段。\n\n## 使用\n\n第二段。",
      personalNote: "个人判断",
      repository: "example/agent",
      slug: "example-agent",
      sourceSummary: "公开摘要",
      type: "工具",
    },
    published_at: "2026-08-10T00:00:00.000Z",
  }]);

  assert.equal(documents.length, 2);
  assert.deepEqual(documents.map((document) => document.id), ["open-source:example-agent:1", "open-source:example-agent:2"]);
  assert.deepEqual(documents.map((document) => document.source_url), ["/open-source/example-agent#安装", "/open-source/example-agent#使用"]);
  assert.ok(documents.every((document) => document.source_id === "example-agent"));
  assert.match(documents[1].search_text, /使用/u);
});

test("README duplicate headings and repository ids remain stable for citation and withdrawal", () => {
  const sections = splitReadmeByHeading("# 介绍\n\n第一段。\n\n## 介绍\n\n第二段。");
  assert.deepEqual(sections.map(({ anchor }) => anchor), ["介绍", "介绍-2"]);

  const documents = toOpenSourceSearchDocuments([{
    content: {
      parsedMarkdown: "# 介绍\n\n第一段。",
      repository: "example/agent",
      slug: "example-agent",
    },
    repo_node_id: "repo-node-1",
  }]);
  assert.equal(documents[0].source_id, "repo-node-1");
  assert.equal(documents[0].source_url, "/open-source/example-agent#介绍");
});
