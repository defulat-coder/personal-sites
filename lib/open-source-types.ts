export const openSourceCategories = [
  { id: "all", label: "全部" },
  { id: "skills", label: "Skills 与工作流" },
  { id: "agents", label: "智能体系统" },
  { id: "context", label: "智能体上下文" },
  { id: "tools", label: "AI 开发工具" },
] as const;

export const openSourceDimensions = [
  { id: "agent-skills", label: "Agent Skills" },
  { id: "coding-agent", label: "Coding Agent" },
  { id: "agent-runtime", label: "Agent 运行时" },
  { id: "long-running", label: "长程 Agent" },
  { id: "multi-agent", label: "多智能体协作" },
  { id: "agent-control", label: "Agent 控制面" },
  { id: "agent-infra", label: "Agent 基础设施" },
  { id: "agent-context", label: "Agent 上下文" },
  { id: "local-retrieval", label: "本地检索" },
  { id: "model-gateway", label: "模型网关" },
  { id: "ai-ingestion", label: "AI 数据入口" },
] as const;

export type OpenSourceCategory = (typeof openSourceCategories)[number]["id"];
export type OpenSourceDimension = (typeof openSourceDimensions)[number]["id"];
export type OpenSourceStatus = "持续跟踪" | "计划试用" | "已提炼";

export type OpenSourceEvidence = {
  checkedAt: string;
  kind: "readme" | "repository";
  label: string;
  note: string;
  url: string;
};

export type OpenSourceEntry = {
  category: Exclude<OpenSourceCategory, "all">;
  caveats: string[];
  dimensions: OpenSourceDimension[];
  evidence: OpenSourceEvidence;
  judgement: string;
  nextStep: string;
  parsedMarkdown?: string | null;
  personalNote: string;
  repository: string;
  repositoryDefaultBranch?: string | null;
  repositoryUrl: string;
  readingSource?: "official-zh-readme" | "kimi-translation";
  readingSourcePath?: string | null;
  scenarios: string[];
  slug: string;
  sourceMarkdown?: string | null;
  sourceSummary: string;
  sourceTitle?: string;
  status: OpenSourceStatus;
  type: string;
  workflow: Array<{ description: string; label: string }>;
};

/**
 * The stream only needs this small public projection. Keeping the long
 * Markdown documents out of the client boundary makes the home route cheap
 * to transfer and hydrate even as the curated repository set grows.
 */
export type OpenSourceListEntry = Pick<
  OpenSourceEntry,
  "category" | "dimensions" | "repository" | "slug" | "sourceSummary" | "status" | "type"
> & {
  /** 判读时间（来自 evidence.checkedAt），快照流按它把条目放进时间轴。 */
  checkedAt: string;
};

export function toOpenSourceListEntry(entry: OpenSourceEntry): OpenSourceListEntry {
  return {
    category: entry.category,
    checkedAt: entry.evidence.checkedAt,
    dimensions: entry.dimensions,
    repository: entry.repository,
    slug: entry.slug,
    sourceSummary: entry.sourceSummary,
    status: entry.status,
    type: entry.type,
  };
}

export function getOpenSourceCategoryLabel(category: OpenSourceCategory) {
  return openSourceCategories.find((item) => item.id === category)?.label ?? category;
}

export function getOpenSourceDimensionLabel(dimension: OpenSourceDimension) {
  return openSourceDimensions.find((item) => item.id === dimension)?.label ?? dimension;
}
