import { z } from "zod";

import publicProjection from "@/knowledge/public/content.json";

const publicItemSchema = z.object({
  category: z.enum(["identity", "project", "knowledge", "practice"]),
  details: z
    .array(
      z.object({
        summary: z.string().min(1),
        title: z.string().min(1),
      }),
    )
    .optional(),
  id: z.string().min(1),
  sortOrder: z.number().int(),
  summary: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url().optional(),
});

const publicProjectionSchema = z.object({
  contentHash: z.string().length(64),
  items: z.array(publicItemSchema),
  schemaVersion: z.literal("2.0.0"),
});

export const publicSiteContent = publicProjectionSchema.parse(publicProjection);

function getRequiredItem(id: string) {
  const item = publicSiteContent.items.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`Missing approved public content item: ${id}`);
  }
  return item;
}

function getRequiredDetailedItem(id: string) {
  const item = getRequiredItem(id);
  if (!item.details) {
    throw new Error(`Missing approved public detail content: ${id}`);
  }
  return { ...item, details: item.details };
}

export const identityContent = getRequiredItem("identity-profile");

export const collectionContent = {
  projects: getRequiredItem("overview-github"),
  knowledge: getRequiredDetailedItem("overview-yuque"),
  practice: getRequiredItem("overview-agent-history"),
} as const;

function createVerifiedStats(
  summary: string,
  stats: ReadonlyArray<{ label: string; value: string }>,
) {
  for (const stat of stats) {
    if (!summarySupportsMetric(summary, stat.value)) {
      throw new Error(`Indexed summary no longer supports metric ${stat.value}`);
    }
  }
  return stats;
}

export function summarySupportsMetric(summary: string, metric: string) {
  const numericTokens: string[] = summary.match(/\d+(?:[,.]\d+)*/gu) ?? [];
  return numericTokens.includes(metric);
}

export const collectionStats = {
  projects: createVerifiedStats(collectionContent.projects.summary, [
    { label: "稳定仓库 Concepts", value: "521" },
    { label: "自有仓库", value: "127" },
    { label: "非 Fork 原始项目", value: "18" },
  ]),
  knowledge: createVerifiedStats(collectionContent.knowledge.summary, [
    { label: "个人知识库", value: "15" },
    { label: "完整文档", value: "1788" },
    { label: "小记", value: "1175" },
  ]),
  practice: createVerifiedStats(collectionContent.practice.summary, [
    { label: "Codex / Claude Code 会话", value: "881" },
    { label: "持久记忆", value: "142" },
    { label: "项目目录", value: "55" },
  ]),
} as const;

export const projectContent = [
  {
    ...getRequiredItem("project-mx-agent"),
    eyebrow: "OKF INDEXED PROJECT",
    image: "/images/source/row-01.webp",
  },
  {
    ...getRequiredItem("project-health-pilot"),
    image: "/images/source/row-02.webp",
  },
  {
    ...getRequiredItem("project-ddd-hr"),
    image: "/images/source/row-03.webp",
  },
  {
    ...getRequiredItem("project-agno-cookbook-cn"),
    image: "/images/source/row-04.webp",
  },
];

export const knowledgeContent = [
  getRequiredDetailedItem("knowledge-aigc"),
  getRequiredDetailedItem("knowledge-product"),
  getRequiredDetailedItem("knowledge-tools"),
  getRequiredDetailedItem("knowledge-learning"),
];

export const practiceContent = [
  {
    ...getRequiredItem("practice-super-agent"),
    image: "/images/source/grid-01.webp",
  },
  {
    ...getRequiredItem("practice-agent-template"),
    image: "/images/source/grid-02.webp",
  },
  {
    ...getRequiredItem("practice-agent-try"),
    image: "/images/source/grid-03.webp",
  },
  {
    ...getRequiredItem("practice-pilot"),
    image: "/images/source/grid-04.webp",
  },
  {
    ...getRequiredItem("practice-auto-coding"),
    image: "/images/source/grid-05.webp",
  },
  {
    ...getRequiredItem("practice-health-pilot"),
    image: "/images/source/grid-06.webp",
  },
];

export type EditorialContentItem = (typeof projectContent)[number];
