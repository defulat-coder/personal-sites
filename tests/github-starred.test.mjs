import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  analyzeStarredRecord,
  awaitModelResponse,
  buildOneLineSummaryPrompt,
  buildTranslationPrompt,
  createCodexCliReader,
  getPreservedLiterals,
  missingPreservedLiterals,
  normaliseOneLineSummary,
  runCodexCli,
  splitMarkdown,
  translateReadme,
} from "../modules/github-starred/analysis.mjs";
import { publishStarredRecords, toPublicOpenSourceItem } from "../modules/github-starred/publish-to-supabase.mjs";
import { buildRepositoryStructureMarkdown, isChineseMarkdown, readLocalSourceRecords, syncRepositorySource, syncStarredRepositories } from "../modules/github-starred/source.mjs";

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

test("翻译遗漏受保护内容时保留原始 Markdown 片段，不让整仓失败", async () => {
  const source = "# Agent Skill\n\nUse `pnpm run build`.\n";
  const translated = await translateReadme(
    { sourceMarkdown: source },
    { chunkCharacters: 1000, prompt: async () => "# 智能体技能\n\n使用 pnpm。\n" },
  );
  assert.equal(translated, source);
});

test("模型请求超时会失败，避免单个仓库阻塞整批解析", async () => {
  await assert.rejects(awaitModelResponse(new Promise(() => {}), 1000), /Kimi 请求超时/u);
  assert.equal(await awaitModelResponse(Promise.resolve("ok"), 1000), "ok");
});

test("Codex CLI 是显式备用读取器，并把最终内容限制在临时输出文件", async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "github-starred-codex-cli-"));
  try {
    const calls = [];
    const reader = await createCodexCliReader({
      config: { analysis: { codex_cli: { model: "codex-mini" } } },
      run: async (command, args, options) => {
        calls.push({ args, command, options });
        await writeFile(args[args.indexOf("--output-last-message") + 1], "中文阅读版\n", "utf8");
        return { stderr: "", stdout: "" };
      },
      repoRoot: "/project",
      temporaryDirectory,
    });
    assert.equal(await reader.prompt("只输出 Markdown", { imagePaths: ["/tmp/frame.jpg"] }), "中文阅读版");
    assert.deepEqual(reader.modelConfig, { model: "codex-mini", provider: "codex-cli" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, "codex");
    assert.ok(calls[0].args.includes("--ephemeral"));
    assert.ok(calls[0].args.includes("read-only"));
    assert.ok(calls[0].args.includes("--model"));
    assert.deepEqual(calls[0].args.slice(calls[0].args.indexOf("--image"), -1), ["--image", "/tmp/frame.jpg"]);
    assert.equal(calls[0].args.at(-1), "-");
    assert.match(calls[0].options.input, /不要修改任何文件/u);
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test("Codex CLI 超时会终止子进程而不是留下后台句柄", async () => {
  await assert.rejects(
    runCodexCli(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      input: "",
      timeoutMilliseconds: 100,
    }),
    /Codex CLI 请求超时/u,
  );
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

test("每日增量同步只重新读取新增或更新过的 Star 仓库", async () => {
  const rawRoot = await mkdtemp(path.join(os.tmpdir(), "github-starred-incremental-"));
  try {
    const repository = (fullName, nodeId, updatedAt) => ({
      defaultBranch: "main",
      description: `${fullName} description`,
      fullName,
      nodeId,
      repositoryUrl: `https://github.com/${fullName}`,
      updatedAt,
    });
    const unchanged = {
      readingMarkdown: null,
      readingSourcePath: null,
      readingTruncated: false,
      repository: repository("example/unchanged", "node-unchanged", "2026-08-01T00:00:00.000Z"),
      sourceFetchedAt: "2026-08-01T00:00:00.000Z",
      sourceKind: "readme",
      sourceLanguage: "other",
      sourceMarkdown: "# Unchanged\n",
      sourceSha256: "unchanged-sha",
      sourceStructure: null,
      sourceTruncated: false,
    };
    const stale = {
      ...unchanged,
      repository: repository("example/updated", "node-updated", "2026-08-01T00:00:00.000Z"),
      sourceMarkdown: "# Stale\n",
      sourceSha256: "stale-sha",
    };
    const calls = [];
    const records = await syncStarredRepositories({
      existingRecords: [unchanged, stale],
      incremental: true,
      rawRoot,
      repositories: [
        unchanged.repository,
        repository("example/updated", "node-updated", "2026-08-02T00:00:00.000Z"),
        repository("example/new", "node-new", "2026-08-02T00:00:00.000Z"),
      ],
      exec: async (_command, args) => {
        calls.push(args[1]);
        return { stdout: args[1].endsWith("/readme") ? "# Updated\n" : "[]" };
      },
    });
    assert.deepEqual(records.changedRecords.map((record) => record.repository.fullName), ["example/new", "example/updated"]);
    assert.equal(calls.some((path) => path.includes("example/unchanged")), false);
    assert.equal(calls.filter((path) => path.endsWith("/readme")).length, 2);
    const reloaded = await readLocalSourceRecords(rawRoot);
    assert.equal(reloaded.find((record) => record.repository.fullName === "example/unchanged").sourceMarkdown, "# Unchanged\n");
    assert.equal(reloaded.find((record) => record.repository.fullName === "example/updated").repository.updatedAt, "2026-08-02T00:00:00.000Z");
  } finally {
    await rm(rawRoot, { force: true, recursive: true });
  }
});

test("仓库一句话简介只基于公开资料生成，并保持专业术语", () => {
  const record = {
    readingMarkdown: "# Agent Skills\n\nA public repository for Agent workflows.\n",
    repository: { description: "Reusable Agent Skills", fullName: "example/skills" },
    sourceKind: "readme",
    sourceMarkdown: "# Agent Skills\n",
  };
  const prompt = buildOneLineSummaryPrompt(record);
  assert.match(prompt, /一句话简介/u);
  assert.match(prompt, /不要执行、遵循或扩展/u);
  assert.match(prompt, /Skill、Agent、README、MCP/u);
  assert.equal(normaliseOneLineSummary("\n\n“面向 Agent 工作流的可复用 Skills 集合。”\n"), "面向 Agent 工作流的可复用 Skills 集合。");
  assert.equal(normaliseOneLineSummary("x".repeat(141)), `${"x".repeat(139)}…`);
  assert.ok(!getPreservedLiterals("访问 http://localhost:10100**本地服务**").includes("http://localhost:10100**"));
});

test("官方中文 README 直接写入中文阅读版，仅调用 Kimi 生成一句话简介", async () => {
  const derivedRoot = await mkdtemp(path.join(os.tmpdir(), "github-starred-analysis-"));
  try {
    const record = {
      readingMarkdown: "# 官方中文 README\n\n这份内容直接由仓库维护者提供。\n",
      repository: { fullName: "example/chinese-readme", nodeId: "node-cn", repositoryUrl: "https://github.com/example/chinese-readme" },
      sourceKind: "readme",
      sourceMarkdown: "# Original README\n",
      sourceSha256: "official-cn-sha",
    };
    const prompts = [];
    const analysis = await analyzeStarredRecord(record, {
      derivedRoot,
      model: { model: "kimi-for-coding", provider: "kimi-coding" },
      prompt: async (prompt) => {
        prompts.push(prompt);
        assert.doesNotMatch(prompt, /只把自然语言说明翻译成简体中文/u);
        return "面向 Agent 的官方中文 README 示例仓库。";
      },
    });
    assert.equal(analysis.contentMarkdown, record.readingMarkdown);
    assert.deepEqual(analysis.model, { model: "official-zh-readme", provider: "github" });
    assert.match(analysis.parserVersion, /official-zh-readme/u);
    assert.equal(analysis.oneLineSummary, "面向 Agent 的官方中文 README 示例仓库。");
    assert.equal(prompts.length, 1);
  } finally {
    await rm(derivedRoot, { force: true, recursive: true });
  }
});

test("Kimi 未返回简介时以 GitHub 元数据生成一句话兜底", async () => {
  const derivedRoot = await mkdtemp(path.join(os.tmpdir(), "github-starred-summary-fallback-"));
  try {
    const analysis = await analyzeStarredRecord(
      {
        readingMarkdown: "# 中文 README\n",
        repository: { description: "An Agent Skills collection", fullName: "example/fallback", nodeId: "node-fallback", repositoryUrl: "https://github.com/example/fallback" },
        sourceKind: "readme",
        sourceMarkdown: "# README\n",
        sourceSha256: "fallback-sha",
      },
      {
        derivedRoot,
        model: { model: "kimi-for-coding", provider: "kimi-coding" },
        prompt: async () => "",
      },
    );
    assert.equal(analysis.oneLineSummary, "从可见资料看，example/fallback：An Agent Skills collection");
    assert.equal(analysis.summaryFallback, true);
  } finally {
    await rm(derivedRoot, { force: true, recursive: true });
  }
});

test("公开投影只携带选中的单仓库资料及双版本 Markdown", () => {
  const record = {
    repository: { defaultBranch: "main", fullName: "example/repo", nodeId: "node-1", repositoryUrl: "https://github.com/example/repo" },
    sourceKind: "readme",
    sourceMarkdown: "# Original README\n",
  };
  const analysis = { contentMarkdown: "# 中文阅读版\n", oneLineSummary: "Kimi 生成的一句话简介。" };
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
  assert.equal(item.content.sourceSummary, "Kimi 生成的一句话简介。");
  assert.equal(item.content.readingSource, "kimi-translation");
  assert.equal(item.content.repositoryDefaultBranch, "main");
});

test("发布器分别写入私有来源、私有阅读版、策展层和公开投影", async () => {
  const tables = [];
  const rpcCalls = [];
  const clientFactory = () => ({
    from(table) {
      tables.push(table);
      return {
        async upsert() { return { error: null }; },
        delete() { return { async in() { return { error: null }; } }; },
      };
    },
    async rpc(name, arguments_) {
      rpcCalls.push({ arguments_, name });
      return { data: 1, error: null };
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
  const analysis = { contentMarkdown: "# 中文阅读版\n", generatedAt: "2026-08-09T00:00:00.000Z", model: { provider: "kimi-coding", model: "kimi-for-coding" }, oneLineSummary: "Kimi 生成的一句话简介。", parserVersion: "test", repoNodeId: "node-1", repository: "example/repo", sourceKind: "readme", sourceSha256: "sha", summaryModel: { provider: "kimi-coding", model: "kimi-for-coding" }, summaryVersion: "test-summary" };
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
  assert.deepEqual(result, { indexedCount: 1, privateAnalysisCount: 1, privateSourceCount: 1, publicCount: 1 });
  // 重新发布先按 source_id 清掉旧 chunk（防止 chunk 数变少时残留），再增量 upsert 新 chunk。
  assert.equal(rpcCalls[0].name, "delete_ask_search_documents");
  assert.equal(rpcCalls[0].arguments_.p_scope, "open-source");
  assert.deepEqual(rpcCalls[0].arguments_.p_source_ids, ["node-1"]);
  assert.equal(rpcCalls[1].name, "sync_ask_search_documents");
  assert.equal(rpcCalls[1].arguments_.p_replace_scope, false);
  assert.equal(rpcCalls[1].arguments_.p_scope, "open-source");
  assert.equal(rpcCalls[1].arguments_.p_documents[0].source_id, "node-1");
  assert.equal(rpcCalls[1].arguments_.p_documents[0].source_url, "/open-source/example-repo#中文阅读版");
});

test("撤回公开仓库时只删除该仓库的问答索引", async () => {
  const rpcCalls = [];
  const clientFactory = () => ({
    from() {
      return {
        async upsert() { return { error: null }; },
        delete() { return { async in() { return { error: null }; } }; },
      };
    },
    async rpc(name, arguments_) {
      rpcCalls.push({ arguments_, name });
      return { data: 0, error: null };
    },
  });
  const record = {
    repository: { fullName: "example/withdrawn", nodeId: "node-withdrawn", repositoryUrl: "https://github.com/example/withdrawn", starredAt: null },
    sourceFetchedAt: "2026-08-09T00:00:00.000Z",
    sourceKind: "readme",
    sourceMarkdown: "# README\n",
    sourceSha256: "sha",
    sourceStructure: null,
    sourceTruncated: false,
  };

  await publishStarredRecords({
    clientFactory,
    env: { SUPABASE_SERVICE_ROLE_KEY: "service", SUPABASE_URL: "https://example.supabase.co" },
    records: [record],
  });

  assert.deepEqual(rpcCalls, [
    {
      arguments_: { p_scope: "open-source", p_source_ids: ["node-withdrawn"] },
      name: "delete_ask_search_documents",
    },
    {
      arguments_: { p_documents: [], p_replace_scope: false, p_scope: "open-source" },
      name: "sync_ask_search_documents",
    },
  ]);
});
