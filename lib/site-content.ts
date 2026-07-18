import { z } from "zod";

import publicProjection from "@/knowledge/public/content.json";

const publicItemSchema = z.object({
  category: z.enum(["identity", "project", "knowledge", "practice"]),
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

export const identityContent = getRequiredItem("identity-profile");

export const collectionContent = {
  projects: getRequiredItem("overview-github"),
  knowledge: getRequiredItem("overview-yuque"),
  practice: getRequiredItem("overview-agent-history"),
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
  getRequiredItem("knowledge-aigc"),
  getRequiredItem("knowledge-product"),
  getRequiredItem("knowledge-tools"),
  getRequiredItem("knowledge-learning"),
];

export const practiceContent = [
  getRequiredItem("practice-super-agent"),
  getRequiredItem("practice-agent-template"),
  getRequiredItem("practice-agent-try"),
  getRequiredItem("practice-pilot"),
  getRequiredItem("practice-auto-coding"),
  getRequiredItem("practice-health-pilot"),
];

export type EditorialContentItem = (typeof projectContent)[number];
