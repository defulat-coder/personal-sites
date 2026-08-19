import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { z } from "zod";

import type { Work, WorkEntry } from "@/lib/works-types";

const workEvidenceSchema = z.object({
  id: z.string(),
  kind: z.enum(["commit", "document", "private-verification"]),
  label: z.string(),
  occurredAt: z.string().nullable(),
  url: z.string().url().optional(),
  verifiedAt: z.string().nullable().optional(),
});

const workRecordSchema = z.object({
  bodyMarkdown: z.string().optional(),
  evidence: z.array(workEvidenceSchema),
  id: z.string(),
  kind: z.enum(["capability", "experiment", "decision", "practice", "milestone"]),
  occurredAt: z.string().nullable().optional(),
  relatedRecordIds: z.array(z.string()),
  status: z.string(),
  summary: z.string(),
  title: z.string(),
  topics: z.array(z.string()),
  updatedAt: z.string(),
});

const publicWorkSnapshotSchema = z.object({
  bodyMarkdown: z.string().optional(),
  currentFocus: z.string(),
  period: z.string(),
  projectId: z.string(),
  records: z.array(workRecordSchema),
  repo: z.string().url().optional(),
  role: z.string(),
  shots: z.array(z.object({ label: z.string(), src: z.string() })),
  slug: z.string(),
  sourceObservedAt: z.string().nullable(),
  stack: z.array(z.string()),
  status: z.string(),
  summary: z.string(),
  title: z.string(),
  url: z.string().url().optional(),
  version: z.literal(1),
});

const workRowSchema = z.object({
  display_order: z.number(),
  published_at: z.string(),
  snapshot: publicWorkSnapshotSchema,
});

function requiredEnvironment(key: "SUPABASE_PUBLISHABLE_KEY" | "SUPABASE_URL") {
  const value = process.env[key];
  if (!value) throw new Error(`缺少 ${key}；构建版块只能从 Supabase 公开项目投影读取。`);
  return value;
}

function getPublicWorksClient() {
  return createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_PUBLISHABLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function toWork(row: z.infer<typeof workRowSchema>): Work {
  const snapshot = row.snapshot;
  return {
    body: snapshot.bodyMarkdown ?? "",
    currentFocus: snapshot.currentFocus,
    order: row.display_order,
    period: snapshot.period,
    publishedAt: row.published_at,
    records: snapshot.records,
    ...(snapshot.repo ? { repo: snapshot.repo } : {}),
    role: snapshot.role,
    shots: snapshot.shots,
    slug: snapshot.slug,
    sourceObservedAt: snapshot.sourceObservedAt,
    stack: snapshot.stack,
    status: snapshot.status,
    summary: snapshot.summary,
    title: snapshot.title,
    ...(snapshot.url ? { url: snapshot.url } : {}),
  };
}

const getCachedWorks = unstable_cache(
  async (): Promise<Work[]> => {
    const { data, error } = await getPublicWorksClient()
      .from("project_public_snapshots")
      .select("display_order,published_at,snapshot")
      .order("display_order", { ascending: true })
      .order("published_at", { ascending: false });
    if (error) throw new Error(`读取 Supabase 项目列表失败：${error.message}`);
    return z.array(workRowSchema).parse(data).map(toWork);
  },
  ["public-project-snapshots-v2"],
  { revalidate: 240, tags: ["public-projects"] },
);

export async function listWorks(): Promise<WorkEntry[]> {
  return getCachedWorks();
}

export const getWork = cache(async (slug: string): Promise<Work | null> => {
  if (!/^[\w-]+$/u.test(slug)) return null;
  const { data, error } = await getPublicWorksClient()
    .from("project_public_snapshots")
    .select("display_order,published_at,snapshot")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`读取 Supabase 项目详情失败：${error.message}`);
  return data ? toWork(workRowSchema.parse(data)) : null;
});
