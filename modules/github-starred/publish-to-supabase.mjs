import { createClient } from "@supabase/supabase-js";

function requiredEnvironment(env, key) {
  const value = env[key];
  if (!value) throw new Error(`缺少 ${key}；仅可在本机或部署环境中配置。`);
  return value;
}

function toSourceRow(record, now) {
  return {
    full_name: record.repository.fullName,
    metadata: record.repository,
    repo_node_id: record.repository.nodeId,
    repository_url: record.repository.repositoryUrl,
    source_fetched_at: record.sourceFetchedAt,
    source_kind: record.sourceKind,
    reading_markdown: record.readingMarkdown,
    source_markdown: record.sourceMarkdown,
    source_sha256: record.sourceSha256,
    source_structure: record.sourceStructure,
    source_truncated: record.sourceTruncated,
    starred_at: record.repository.starredAt,
    synced_at: now,
  };
}

function toAnalysisRow(analysis, now) {
  return {
    analysis_metadata: {
      oneLineSummary: analysis.oneLineSummary,
      repository: analysis.repository,
      sourceKind: analysis.sourceKind,
      summaryModel: analysis.summaryModel,
      summaryFallback: analysis.summaryFallback,
      summaryVersion: analysis.summaryVersion,
    },
    content_markdown: analysis.contentMarkdown,
    generated_at: analysis.generatedAt,
    language: "zh-CN",
    model_name: analysis.model.model,
    model_provider: analysis.model.provider,
    parser_version: analysis.parserVersion,
    repo_node_id: analysis.repoNodeId,
    source_sha256: analysis.sourceSha256,
    synced_at: now,
  };
}

function toCurationRow(record, entry, displayRank, now) {
  if (!entry) return { repo_node_id: record.repository.nodeId };
  return {
    caveats: entry.caveats,
    category: entry.category,
    dimensions: entry.dimensions,
    display_rank: displayRank,
    judgement: entry.judgement,
    next_step: entry.nextStep,
    personal_note: entry.personalNote,
    repo_node_id: record.repository.nodeId,
    reviewed_at: now,
    scenarios: entry.scenarios,
    status: entry.status,
    type: entry.type,
    visibility: "published",
    workflow: entry.workflow,
  };
}

export function toPublicOpenSourceItem(record, analysis, entry, displayRank, now) {
  return {
    content: {
      category: entry.category,
      caveats: entry.caveats,
      dimensions: entry.dimensions,
      evidence: entry.evidence,
      judgement: entry.judgement,
      nextStep: entry.nextStep,
      parsedMarkdown: analysis.contentMarkdown,
      personalNote: entry.personalNote,
      repository: entry.repository,
      repositoryUrl: entry.repositoryUrl,
      readingSource: record.readingMarkdown ? "official-zh-readme" : "kimi-translation",
      readingSourcePath: record.readingSourcePath,
      scenarios: entry.scenarios,
      slug: entry.slug,
      sourceMarkdown: record.sourceMarkdown,
      sourceSummary: analysis.oneLineSummary ?? entry.sourceSummary,
      sourceTitle: record.sourceKind === "readme" ? "原始 README" : "仓库结构证据",
      status: entry.status,
      type: entry.type,
      workflow: entry.workflow,
    },
    display_rank: displayRank,
    published_at: now,
    repo_node_id: record.repository.nodeId,
    slug: entry.slug,
    synced_at: now,
  };
}

async function upsert(client, table, rows, options, description) {
  if (rows.length === 0) return;
  const { error } = await client.from(table).upsert(rows, options);
  if (error) throw new Error(`${description}失败：${error.message}`);
}

/**
 * Persist all source/AI output privately and publish only explicitly selected
 * repositories that have a matching analysis. No browser client gets the
 * service-role key used here.
 */
export async function publishStarredRecords({ analyses = [], clientFactory = createClient, env = process.env, records, seedEntries = [] }) {
  const client = clientFactory(
    requiredEnvironment(env, "SUPABASE_URL"),
    requiredEnvironment(env, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const now = new Date().toISOString();
  const analysisByNodeId = new Map(analyses.map((analysis) => [analysis.repoNodeId, analysis]));
  const seedByRepository = new Map(seedEntries.map((entry, index) => [entry.repository, { entry, index }]));

  await upsert(
    client,
    "github_starred_sources",
    records.map((record) => toSourceRow(record, now)),
    { onConflict: "repo_node_id" },
    "写入 Supabase 私有 Star 原始资料",
  );
  await upsert(
    client,
    "github_starred_analyses",
    analyses.map((analysis) => toAnalysisRow(analysis, now)),
    { onConflict: "repo_node_id" },
    "写入 Supabase 私有 Star 中文阅读版",
  );

  await upsert(
    client,
    "github_starred_curation",
    records.map((record) => toCurationRow(record)),
    { onConflict: "repo_node_id", ignoreDuplicates: true },
    "初始化 Supabase Star 策展层",
  );
  await upsert(
    client,
    "github_starred_curation",
    records.flatMap((record) => {
      const selected = seedByRepository.get(record.repository.fullName);
      return selected ? [toCurationRow(record, selected.entry, selected.index, now)] : [];
    }),
    { onConflict: "repo_node_id" },
    "更新 Supabase 已发布 Star 策展层",
  );

  const publicRows = records.flatMap((record) => {
    const selected = seedByRepository.get(record.repository.fullName)?.entry;
    const analysis = analysisByNodeId.get(record.repository.nodeId);
    return selected && analysis ? [toPublicOpenSourceItem(record, analysis, selected, seedByRepository.get(record.repository.fullName).index, now)] : [];
  });
  await upsert(
    client,
    "github_open_source_items",
    publicRows,
    { onConflict: "repo_node_id" },
    "写入 Supabase 公开开源关注投影",
  );

  const unpublishedRecordIds = records
    .filter((record) => !publicRows.some((row) => row.repo_node_id === record.repository.nodeId))
    .map((record) => record.repository.nodeId);
  if (unpublishedRecordIds.length > 0) {
    const { error } = await client.from("github_open_source_items").delete().in("repo_node_id", unpublishedRecordIds);
    if (error) throw new Error(`撤回未发布开源关注投影失败：${error.message}`);
  }

  return {
    privateAnalysisCount: analyses.length,
    privateSourceCount: records.length,
    publicCount: publicRows.length,
  };
}
