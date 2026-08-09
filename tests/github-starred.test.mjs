import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  analyzeStarredRecord,
  buildTranslationPrompt,
  missingPreservedLiterals,
  splitMarkdown,
} from "../modules/github-starred/analysis.mjs";
import { publishStarredRecords, toPublicOpenSourceItem } from "../modules/github-starred/publish-to-supabase.mjs";
import { buildRepositoryStructureMarkdown, isChineseMarkdown, readLocalSourceRecords, syncRepositorySource } from "../modules/github-starred/source.mjs";

test("中文阅读版校验代码、链接和 Agent 术语保持原样", () => {
  const source = "# Agent Skill\n\nUse `pnpm run build` with [GitHub](https://github.com/example/repo).\n\n```ts\nconst api = '/v1';\n```\n";
  const translated = "# Agent Skill\n\n使用 `pnpm run build` 配合 [GitHub](https://github.com/example/repo)。\n\n```ts\nconst api = '/v1';\n```\n";
  assert.deepEqual(missingPreservedLiterals(source, translated), []);
  assert.deepEqual(missingPreservedLiterals(source, translated.replace("Agent", "智能体")), ["Agent"]);
  assert.deepEqual(missingPreservedLiterals(source, translated.replace("pnpm run build", "pnpm build")), ["`pnpm run build`"]);

  const prompt = buildTranslationPrompt(source, { chunkIndex: 1, totalChunks: 1 });
  assert.match(prompt, /Skill\/Skills、Agent\/Agents、README/u);
  assert.match(prompt, /不可翻译/u);
});

test("大 README 只在 Markdown 边界拆分，保留所有片段", () => {
  const source = "# title\n\n" + "paragraph\n\n".repeat(500);
  const chunks = splitMarkdown(source, 1000);
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(""), source);
  assert.ok(chunks.every((chunk) => chunk.length <= 1000));
});

test("README 缺失时以仓库结构作为原始证据", () => {
  const markdown = buildRepositoryStructureMarkdown(
    { fullName: "example/no-readme" },
    [{ path: "src", type: "dir" }, { path: "package.json", type: "file" }],
    { "package.json": '{"name":"no-readme"}' },
  );
  assert.match(markdown, /README 不存在/u);
  assert.match(markdown, /\[dir\] src/u);
  assert.match(markdown, /## package\.json/u);
});

test("原始中文 README 直接成为中文阅读版", async () => {
  const rawRoot = await mkdtemp(path.join(os.tmpdir(), "github-starred-source-"));
  try {
    const record = await syncRepositorySource(
      {
        defaultBranch: "main",
        fullName: "example/chinese-readme",
        nodeId: "node-cn",
        repositoryUrl: "https://github.com/example/chinese-readme",
      },
      {
        rawRoot,
        exec: async () => ({ stdout: "# 示例\n\n这是仓库维护的中文 README，包含足够多的说明文字用于识别中文原文，而不是模型翻译结果。\n" }),
      },
    );
    assert.equal(isChineseMarkdown(record.sourceMarkdown), true);
    assert.equal(record.readingMarkdown, record.sourceMarkdown);
    assert.equal(record.readingSourcePath, "README");
    const [reloaded] = await readLocalSourceRecords(rawRoot);
    assert.equal(reloaded.readingMarkdown, record.sourceMarkdown);
  } finally {
    await rm(rawRoot, { force: true, recursive: true });
  }
});

test("官方中文 README 不调用 Kimi，直接写入中文阅读版", async () => {
  const derivedRoot = await mkdtemp(path.join(os.tmpdir(), "github-starred-analysis-"));
  try {
    const record = {
      readingMarkdown: "# 官方中文 README\n\n这份内容直接由仓库维护者提供。\n",
      repository: { fullName: "example/chinese-readme", nodeId: "node-cn", repositoryUrl: "https://github.com/example/chinese-readme" },
      sourceKind: "readme",
      sourceMarkdown: "# Original README\n",
      sourceSha256: "official-cn-sha",
    };
    const analysis = await analyzeStarredRecord(record, {
      derivedRoot,
      prompt: async () => { throw new Error("官方中文 README 不应调用 Kimi"); },
    });
    assert.equal(analysis.contentMarkdown, record.readingMarkdown);
    assert.deepEqual(analysis.model, { model: "official-zh-readme", provider: "github" });
    assert.match(analysis.parserVersion, /official-zh-readme/u);
  } finally {
    await rm(derivedRoot, { force: true, recursive: true });
  }
});

test("公开投影只携带选中的单仓库资料及双版本 Markdown", () => {
  const record = {
    repository: { fullName: "example/repo", nodeId: "node-1", repositoryUrl: "https://github.com/example/repo" },
    sourceKind: "readme",
    sourceMarkdown: "# Original README\n",
  };
  const analysis = { contentMarkdown: "# 中文阅读版\n" };
  const entry = {
    category: "skills",
    caveats: [],
    dimensions: ["agent-skills"],
    evidence: { checkedAt: "2026-08-09", kind: "readme", label: "README.md", note: "来源", url: "https://github.com/example/repo/blob/main/README.md" },
    judgement: "判断",
    nextStep: "下一步",
    personalNote: "备注",
    repository: "example/repo",
    repositoryUrl: "https://github.com/example/repo",
    scenarios: [],
    slug: "example-repo",
    sourceSummary: "摘要",
    status: "持续跟踪",
    type: "Skill",
    workflow: [],
  };
  const item = toPublicOpenSourceItem(record, analysis, entry, 2, "2026-08-09T00:00:00.000Z");
  assert.equal(item.repo_node_id, "node-1");
  assert.equal(item.display_rank, 2);
  assert.equal(item.content.sourceMarkdown, "# Original README\n");
  assert.equal(item.content.parsedMarkdown, "# 中文阅读版\n");
  assert.equal(item.content.readingSource, "kimi-translation");
});

test("发布器分别写入私有来源、私有阅读版、策展层和公开投影", async () => {
  const tables = [];
  const clientFactory = () => ({
    from(table) {
      tables.push(table);
      return {
        async upsert() { return { error: null }; },
        delete() { return { async in() { return { error: null }; } }; },
      };
    },
  });
  const record = {
    repository: { fullName: "example/repo", nodeId: "node-1", repositoryUrl: "https://github.com/example/repo", starredAt: null },
    sourceFetchedAt: "2026-08-09T00:00:00.000Z",
    sourceKind: "readme",
    sourceMarkdown: "# Original README\n",
    sourceSha256: "sha",
    sourceStructure: null,
    sourceTruncated: false,
  };
  const entry = {
    category: "skills", caveats: [], dimensions: ["agent-skills"],
    evidence: { checkedAt: "2026-08-09", kind: "readme", label: "README.md", note: "来源", url: "https://github.com/example/repo/blob/main/README.md" },
    judgement: "判断", nextStep: "下一步", personalNote: "备注", repository: "example/repo", repositoryUrl: "https://github.com/example/repo",
    scenarios: [], slug: "example-repo", sourceSummary: "摘要", status: "持续跟踪", type: "Skill", workflow: [],
  };
  const analysis = { contentMarkdown: "# 中文阅读版\n", generatedAt: "2026-08-09T00:00:00.000Z", model: { provider: "kimi-coding", model: "kimi-for-coding" }, parserVersion: "test", repoNodeId: "node-1", repository: "example/repo", sourceKind: "readme", sourceSha256: "sha" };
  const result = await publishStarredRecords({
    analyses: [analysis],
    clientFactory,
    env: { SUPABASE_SERVICE_ROLE_KEY: "service", SUPABASE_URL: "https://example.supabase.co" },
    records: [record],
    seedEntries: [entry],
  });
  assert.deepEqual(tables, [
    "github_starred_sources",
    "github_starred_analyses",
    "github_starred_curation",
    "github_starred_curation",
    "github_open_source_items",
  ]);
  assert.deepEqual(result, { privateAnalysisCount: 1, privateSourceCount: 1, publicCount: 1 });
});
