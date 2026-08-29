import "server-only";

import { cache } from "react";
import { z } from "zod";

import {
  getOpenSourceCategoryLabel,
  getOpenSourceDimensionLabel,
  openSourceCategories,
  openSourceDimensions,
  toOpenSourceListEntry,
} from "@/lib/open-source-types";
import type { OpenSourceEntry, OpenSourceListEntry } from "@/lib/open-source-types";
import { getPublicDatabase } from "@/lib/public-database";

export {
  getOpenSourceCategoryLabel,
  getOpenSourceDimensionLabel,
  openSourceCategories,
  openSourceDimensions,
};
export type {
  OpenSourceCategory,
  OpenSourceDimension,
  OpenSourceEntry,
  OpenSourceEvidence,
  OpenSourceListEntry,
  OpenSourceStatus,
} from "@/lib/open-source-types";

const openSourceEntrySchema = z.object({
  category: z.enum(["skills", "agents", "context", "tools"]),
  caveats: z.array(z.string()),
  dimensions: z.array(z.enum([
    "agent-skills", "coding-agent", "agent-runtime", "long-running", "multi-agent",
    "agent-control", "agent-infra", "agent-context", "local-retrieval", "model-gateway", "ai-ingestion",
  ])),
  evidence: z.object({
    checkedAt: z.string(),
    kind: z.enum(["readme", "repository"]),
    label: z.string(),
    note: z.string(),
    url: z.string().url(),
  }),
  judgement: z.string(),
  nextStep: z.string(),
  parsedMarkdown: z.string().nullable().optional(),
  personalNote: z.string(),
  readingSource: z.enum(["official-zh-readme", "model-translation"]).optional(),
  readingSourcePath: z.string().nullable().optional(),
  repository: z.string(),
  repositoryDefaultBranch: z.string().nullable().optional(),
  repositoryUrl: z.string().url(),
  scenarios: z.array(z.string()),
  slug: z.string(),
  sourceMarkdown: z.string().nullable().optional(),
  sourceSummary: z.string(),
  sourceTitle: z.string().optional(),
  status: z.enum(["持续跟踪", "计划试用", "已提炼"]),
  type: z.string(),
  workflow: z.array(z.object({ description: z.string(), label: z.string() })),
});

const contentRowSchema = z.object({ content_json: z.string().min(1) });

function parseEntry(contentJson: string): OpenSourceEntry {
  return openSourceEntrySchema.parse(JSON.parse(contentJson));
}

export async function getOpenSourceListEntries(): Promise<OpenSourceListEntry[]> {
  return getPublicDatabase()
    .prepare("SELECT content_json FROM open_source_items ORDER BY display_rank ASC, published_at DESC")
    .all()
    .map((row) => contentRowSchema.parse(row))
    .map((row) => toOpenSourceListEntry(parseEntry(row.content_json)));
}

export const getOpenSourceEntry = cache(async (slug: string): Promise<OpenSourceEntry | null> => {
  if (!/^[\w-]+$/u.test(slug)) return null;
  const row = getPublicDatabase().prepare("SELECT content_json FROM open_source_items WHERE slug = ?").get(slug);
  return row ? parseEntry(contentRowSchema.parse(row).content_json) : null;
});
