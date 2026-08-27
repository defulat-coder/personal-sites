import assert from "node:assert/strict";
import test from "node:test";

import { splitReadmeByHeading, toDailySearchDocuments, toOpenSourceSearchDocuments } from "../modules/ask/search-index.mjs";

test("daily public projections become one searchable document per item", () => {
  const [document] = toDailySearchDocuments([{
    content: {
      analysis: "分析内容",
      author: { handle: "cy", name: "陈远" },
      id: "tweet-1",
      publishedAt: "2026-08-10T00:00:00.000Z",
      summary: "摘要内容",
      tags: ["Agent", "检索"],
      text: "公开原文",
      title: "全文检索实践",
    },
  }]);

  assert.equal(document.id, "daily:tweet-1");
  assert.equal(document.source_url, "/curation/tweet-1");
  assert.match(document.search_text, /陈远/u);
  assert.match(document.search_text, /Agent/u);
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
