import "server-only";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { z } from "zod";

import {
  getOpenSourceCategoryLabel,
  getOpenSourceDimensionLabel,
  openSourceCategories,
  openSourceDimensions,
} from "@/lib/open-source-types";
import type { OpenSourceEntry } from "@/lib/open-source-types";
import type { OpenSourceEvidence } from "@/lib/open-source-types";
import type { OpenSourceListEntry } from "@/lib/open-source-types";

export type OpenSourceDetailEntry = Pick<
  OpenSourceEntry,
  | "parsedMarkdown"
  | "personalNote"
  | "readingSource"
  | "readingSourcePath"
  | "repository"
  | "repositoryDefaultBranch"
  | "repositoryUrl"
  | "slug"
> & {
  evidence: Pick<OpenSourceEvidence, "url">;
};

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

const openSourceListEntrySchema = z.object({
  category: z.enum(["skills", "agents", "context", "tools"]),
  checkedAt: z.string(),
  dimensions: z.array(z.enum([
    "agent-skills",
    "coding-agent",
    "agent-runtime",
    "long-running",
    "multi-agent",
    "agent-control",
    "agent-infra",
    "agent-context",
    "local-retrieval",
    "model-gateway",
    "ai-ingestion",
  ])),
  repository: z.string(),
  slug: z.string(),
  sourceSummary: z.string(),
  status: z.enum(["持续跟踪", "计划试用", "已提炼"]),
  type: z.string(),
});

const openSourceDetailEntrySchema = z.object({
  evidence: z.object({
    url: z.string().url(),
  }),
  parsedMarkdown: z.string().min(1),
  personalNote: z.string(),
  readingSource: z.enum(["official-zh-readme", "kimi-translation"]),
  readingSourcePath: z.string().nullable(),
  repository: z.string(),
  repositoryDefaultBranch: z.string().min(1).nullable().optional(),
  repositoryUrl: z.string().url(),
  slug: z.string(),
});

function requiredEnvironment(key: "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY") {
  const value = process.env[key];
  if (!value) throw new Error(`缺少 ${key}；网站开源关注只能从 Supabase 公开投影读取。`);
  return value;
}

function getPublicOpenSourceClient() {
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_PUBLISHABLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const getCachedOpenSourceListEntries = unstable_cache(
  async (): Promise<OpenSourceListEntry[]> => {
    const client = getPublicOpenSourceClient();
    const { data, error } = await client
      .from("github_open_source_items")
      .select("category:content->>category,checkedAt:content->evidence->>checkedAt,dimensions:content->dimensions,repository:content->>repository,slug,sourceSummary:content->>sourceSummary,status:content->>status,type:content->>type")
      .order("display_rank", { ascending: true, nullsFirst: false })
      .order("published_at", { ascending: false });
    if (error) throw new Error(`读取 Supabase 开源关注列表失败：${error.message}`);
    return z.array(openSourceListEntrySchema).parse(data);
  },
  ["public-open-source-list-v1"],
  { revalidate: 240, tags: ["public-open-source"] },
);

export async function getOpenSourceListEntries(): Promise<OpenSourceListEntry[]> {
  return getCachedOpenSourceListEntries();
}

const getCachedOpenSourceEntry = unstable_cache(
  async (slug: string): Promise<OpenSourceDetailEntry | null> => {
    const client = getPublicOpenSourceClient();
    const { data, error } = await client
      .from("github_open_source_items")
      .select("evidence:content->evidence,parsedMarkdown:content->>parsedMarkdown,personalNote:content->>personalNote,readingSource:content->>readingSource,readingSourcePath:content->>readingSourcePath,repository:content->>repository,repositoryDefaultBranch:content->>repositoryDefaultBranch,repositoryUrl:content->>repositoryUrl,slug")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error(`读取 Supabase 开源关注详情失败：${error.message}`);
    return data ? openSourceDetailEntrySchema.parse(data) : null;
  },
  ["public-open-source-entry-v2"],
  { revalidate: 240, tags: ["public-open-source"] },
);

export const getOpenSourceEntry = cache(async (slug: string): Promise<OpenSourceDetailEntry | null> => {
  return getCachedOpenSourceEntry(slug);
});
