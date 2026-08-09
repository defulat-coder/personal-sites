import "server-only";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { connection } from "next/server";
import { cache } from "react";
import { z } from "zod";

import {
  getOpenSourceCategoryLabel,
  getOpenSourceDimensionLabel,
  openSourceCategories,
  openSourceDimensions,
} from "@/lib/open-source-types";
import type { OpenSourceEntry } from "@/lib/open-source-types";
import type { OpenSourceListEntry } from "@/lib/open-source-types";

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
  evidence: z.object({
    checkedAt: z.string(),
    kind: z.enum(["readme", "repository"]),
    label: z.string(),
    note: z.string(),
    url: z.string().url(),
  }),
  judgement: z.string(),
  nextStep: z.string(),
  parsedMarkdown: z.string().min(1),
  personalNote: z.string(),
  repository: z.string(),
  repositoryDefaultBranch: z.string().min(1).nullable().optional(),
  repositoryUrl: z.string().url(),
  readingSource: z.enum(["official-zh-readme", "kimi-translation"]),
  readingSourcePath: z.string().nullable(),
  scenarios: z.array(z.string()),
  slug: z.string(),
  sourceMarkdown: z.string().min(1),
  sourceSummary: z.string(),
  sourceTitle: z.string(),
  status: z.enum(["持续跟踪", "计划试用", "已提炼"]),
  type: z.string(),
  workflow: z.array(z.object({ description: z.string(), label: z.string() })),
});

const openSourceListEntrySchema = z.object({
  category: z.enum(["skills", "agents", "context", "tools"]),
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

function requiredEnvironment(key: "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY") {
  const value = process.env[key];
  if (!value) throw new Error(`缺少 ${key}；网站开源关注只能从 Supabase 公开投影读取。`);
  return value;
}

async function getOpenSourceClient() {
  await connection();
  return getPublicOpenSourceClient();
}

function getPublicOpenSourceClient() {
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_PUBLISHABLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function getOpenSourceEntries(): Promise<OpenSourceEntry[]> {
  const client = await getOpenSourceClient();
  const { data, error } = await client
    .from("github_open_source_items")
    .select("content")
    .order("display_rank", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false });
  if (error) throw new Error(`读取 Supabase 开源关注投影失败：${error.message}`);
  return z.array(openSourceEntrySchema).parse(data.map((row) => row.content));
}

const getCachedOpenSourceListEntries = unstable_cache(
  async (): Promise<OpenSourceListEntry[]> => {
    const client = getPublicOpenSourceClient();
    const { data, error } = await client
      .from("github_open_source_items")
      .select("category:content->>category,dimensions:content->dimensions,repository:content->>repository,slug,sourceSummary:content->>sourceSummary,status:content->>status,type:content->>type")
      .order("display_rank", { ascending: true, nullsFirst: false })
      .order("published_at", { ascending: false });
    if (error) throw new Error(`读取 Supabase 开源关注列表失败：${error.message}`);
    return z.array(openSourceListEntrySchema).parse(data);
  },
  ["public-open-source-list-v1"],
  { revalidate: 60, tags: ["public-open-source"] },
);

export async function getOpenSourceListEntries(): Promise<OpenSourceListEntry[]> {
  await connection();
  return getCachedOpenSourceListEntries();
}

export const getOpenSourceEntry = cache(async (slug: string): Promise<OpenSourceEntry | null> => {
  const client = await getOpenSourceClient();
  const { data, error } = await client
    .from("github_open_source_items")
    .select("content")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`读取 Supabase 开源关注详情失败：${error.message}`);
  return data ? openSourceEntrySchema.parse(data.content) : null;
});
