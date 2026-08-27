import "server-only";

import { cache } from "react";

import { z } from "zod";

import type { Work } from "@/lib/works-types";
import { getPublicDatabase } from "@/lib/public-database";

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
  snapshot_json: z.string().min(1),
});

function toWork(row: z.infer<typeof workRowSchema>): Work {
  const snapshot = publicWorkSnapshotSchema.parse(JSON.parse(row.snapshot_json));
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

export async function listWorks(): Promise<Work[]> {
  return getPublicDatabase()
    .prepare("SELECT display_order, published_at, snapshot_json FROM project_snapshots ORDER BY display_order ASC, published_at DESC")
    .all()
    .map((row) => toWork(workRowSchema.parse(row)));
}

export const getWork = cache(async (slug: string): Promise<Work | null> => {
  if (!/^[\w-]+$/u.test(slug)) return null;
  const row = getPublicDatabase()
    .prepare("SELECT display_order, published_at, snapshot_json FROM project_snapshots WHERE slug = ?")
    .get(slug);
  return row ? toWork(workRowSchema.parse(row)) : null;
});
