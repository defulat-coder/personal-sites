import { z } from "zod";

export const PROJECT_RECORD_KINDS = ["capability", "experiment", "decision", "practice", "milestone"];

const identifierSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

export const projectCatalogEntrySchema = z.object({
  directory: z.string().min(1),
  documents: z.array(z.string().min(1)).default([]),
  id: identifierSchema,
  memoryDirectories: z.array(z.string().min(1)).default([]),
  order: z.number().int(),
  period: z.string().min(1),
  repo: z.string().url().optional(),
  review: z.object({
    bodyMarkdown: z.string().optional(),
    currentFocus: z.string().min(1).optional(),
    exclude: z.array(identifierSchema).default([]),
    overrides: z.record(identifierSchema, z.object({
      bodyMarkdown: z.string().optional(),
      kind: z.enum(PROJECT_RECORD_KINDS).optional(),
      status: z.string().min(1).optional(),
      summary: z.string().min(1).optional(),
      title: z.string().min(1).optional(),
    })).default({}),
    summary: z.string().min(1).optional(),
  }).default({ exclude: [], overrides: {} }),
  role: z.string().min(1),
  shots: z.array(z.object({ label: z.string().min(1), src: z.string().startsWith("/") })).default([]),
  slug: identifierSchema,
  stack: z.array(z.string().min(1)).default([]),
  status: z.string().min(1),
  summary: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url().optional(),
});

export const projectCatalogSchema = z.array(projectCatalogEntrySchema).min(1);

export const sourceEvidenceSchema = z.object({
  content: z.string(),
  id: z.string().min(1),
  kind: z.enum(["commit", "document", "private-verification"]),
  label: z.string().min(1),
  occurredAt: z.string().nullable(),
  url: z.string().url().optional(),
});

export const evidenceSnapshotSchema = z.object({
  evidence: z.array(sourceEvidenceSchema),
  projectId: identifierSchema,
  sourceDigest: z.string().length(64),
  sourceObservedAt: z.string().nullable(),
});

export const publicEvidenceSchema = sourceEvidenceSchema.omit({ content: true }).extend({
  verifiedAt: z.string().nullable().optional(),
});

export const projectRecordSchema = z.object({
  bodyMarkdown: z.string().optional(),
  evidence: z.array(publicEvidenceSchema).min(1),
  id: identifierSchema,
  kind: z.enum(PROJECT_RECORD_KINDS),
  occurredAt: z.string().nullable().optional(),
  relatedRecordIds: z.array(identifierSchema).default([]),
  status: z.string().min(1),
  summary: z.string().min(1),
  title: z.string().min(1),
  topics: z.array(z.string().min(1)).max(6).default([]),
  updatedAt: z.string().min(1),
});

export const projectDraftSchema = z.object({
  bodyMarkdown: z.string().optional(),
  currentFocus: z.string().min(1),
  extractorVersion: z.string().min(1),
  generatedAt: z.string().min(1),
  projectId: identifierSchema,
  records: z.array(projectRecordSchema).max(24),
  sourceDigest: z.string().length(64),
  sourceObservedAt: z.string().nullable(),
  summary: z.string().min(1),
});

export const approvedProjectSchema = projectDraftSchema.extend({
  approvedAt: z.string().min(1),
  approvedDigest: z.string().length(64),
});

export const publicProjectSnapshotSchema = z.object({
  bodyMarkdown: z.string().optional(),
  currentFocus: z.string().min(1),
  period: z.string().min(1),
  projectId: identifierSchema,
  records: z.array(projectRecordSchema),
  repo: z.string().url().optional(),
  role: z.string().min(1),
  shots: z.array(z.object({ label: z.string().min(1), src: z.string().startsWith("/") })),
  slug: identifierSchema,
  sourceObservedAt: z.string().nullable(),
  stack: z.array(z.string().min(1)),
  status: z.string().min(1),
  summary: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url().optional(),
  version: z.literal(1),
});
