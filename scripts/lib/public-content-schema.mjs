import { z } from "zod";

export const publicCategorySchema = z.enum([
  "identity",
  "project",
  "knowledge",
  "practice",
]);

export const exclusionReasonSchema = z.enum([
  "private_personal_data",
  "third_party_confidentiality",
  "third_party_content",
  "unsupported_claim",
  "low_signal",
  "unsafe_secret",
]);

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const identifierSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const indexPathSchema = z
  .string()
  .regex(/^(?:[a-z0-9._-]+\/)*index\.md$/u);
const claimFieldSchema = z.enum(["title", "summary", "details", "url"]);

const publicDetailSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(360),
});

const sourceSelectionSchema = z.object({
  id: identifierSchema,
  kind: z.literal("okf-index-catalog"),
  locator: z.literal("complete-okf-indexes"),
});

const outputSelectionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(360),
  details: z.array(publicDetailSchema).min(1).max(24).optional(),
  url: z.string().url().optional(),
});

const recordBaseSchema = z.object({
  id: identifierSchema,
  category: publicCategorySchema,
  sourceId: identifierSchema,
});

const publishedSelectionSchema = recordBaseSchema.extend({
  status: z.literal("published"),
  sortOrder: z.number().int().nonnegative(),
  output: outputSelectionSchema,
  evidence: z
    .array(
      z.object({
        indexPath: indexPathSchema,
        fields: z.array(claimFieldSchema).min(1),
        fragments: z.array(z.string().trim().min(1)).min(1),
      }),
    )
    .min(1),
});

const excludedSelectionSchema = recordBaseSchema.extend({
  status: z.literal("excluded"),
  exclusionReason: exclusionReasonSchema,
});

export const publicContentSelectionSchema = z
  .object({
    schemaVersion: z.literal("2.0.0"),
    sources: z.array(sourceSelectionSchema).min(1),
    records: z
      .array(
        z.discriminatedUnion("status", [
          publishedSelectionSchema,
          excludedSelectionSchema,
        ]),
      )
      .min(1),
  })
  .superRefine((selection, context) => {
    const sourceIds = selection.sources.map((source) => source.id);
    const recordIds = selection.records.map((record) => record.id);
    for (const [label, values] of [
      ["source", sourceIds],
      ["record", recordIds],
    ]) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          message: `Duplicate ${label} id`,
        });
      }
    }
    const knownSources = new Set(sourceIds);
    for (const record of selection.records) {
      if (!knownSources.has(record.sourceId)) {
        context.addIssue({
          code: "custom",
          message: `Unknown sourceId ${record.sourceId}`,
        });
      }
      if (record.status === "published") {
        const expectedFields = [
          "title",
          "summary",
          ...(record.output.details ? ["details"] : []),
          ...(record.output.url ? ["url"] : []),
        ];
        const evidencedFields = new Set(
          record.evidence.flatMap((entry) => entry.fields),
        );
        for (const field of expectedFields) {
          if (!evidencedFields.has(field)) {
            context.addIssue({
              code: "custom",
              message: `Missing ${field} evidence for ${record.id}`,
            });
          }
        }
        if (!record.output.url && evidencedFields.has("url")) {
          context.addIssue({
            code: "custom",
            message: `Unexpected url evidence for ${record.id}`,
          });
        }
      }
    }
    const publishedCategories = new Set(
      selection.records
        .filter((record) => record.status === "published")
        .map((record) => record.category),
    );
    for (const category of publicCategorySchema.options) {
      if (!publishedCategories.has(category)) {
        context.addIssue({
          code: "custom",
          message: `Missing published category ${category}`,
        });
      }
    }
  });

const provenanceSchema = z.object({
  sourceId: identifierSchema,
  sourceSha256: sha256Schema,
  evidenceSha256: sha256Schema,
  fields: z.array(claimFieldSchema).min(1),
  indexPaths: z.array(indexPathSchema).min(1),
});

export const publicClaimSchema = z.discriminatedUnion("field", [
  z.object({
    field: z.literal("details"),
    value: z.array(publicDetailSchema).min(1),
    evidenceSha256: sha256Schema,
  }),
  z.object({
    field: claimFieldSchema.exclude(["details"]),
    value: z.string().min(1),
    evidenceSha256: sha256Schema,
  }),
]);

export const publicContentItemSchema = z.object({
  id: identifierSchema,
  category: publicCategorySchema,
  sortOrder: z.number().int().nonnegative(),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(360),
  details: z.array(publicDetailSchema).min(1).max(24).optional(),
  url: z.string().url().optional(),
  claims: z.array(publicClaimSchema).min(2),
  provenance: z.array(provenanceSchema).min(1),
});

export const publicContentProjectionSchema = z.object({
  schemaVersion: z.literal("2.0.0"),
  generatorVersion: z.literal("2.0.0"),
  items: z.array(publicContentItemSchema).min(4),
  contentHash: sha256Schema,
});

const sourceManifestSchema = z.object({
  id: identifierSchema,
  kind: z.literal("index-source"),
  sha256: sha256Schema,
  indexFileCount: z.number().int().positive(),
  disposition: z.enum(["published", "excluded-only", "mixed"]),
});

const recordManifestSchema = z.object({
  id: identifierSchema,
  category: publicCategorySchema,
  sourceId: identifierSchema,
  sourceSha256: sha256Schema,
  status: z.enum(["published", "excluded"]),
  outputIds: z.array(identifierSchema),
  indexPaths: z.array(indexPathSchema).optional(),
  evidenceSha256: sha256Schema.optional(),
  exclusionReason: exclusionReasonSchema.optional(),
});

const categoryCountSchema = z.object({
  selected: z.number().int().nonnegative(),
  published: z.number().int().nonnegative(),
  excluded: z.number().int().nonnegative(),
});

export const publicContentManifestSchema = z.object({
  schemaVersion: z.literal("2.0.0"),
  generatorVersion: z.literal("2.0.0"),
  generationId: sha256Schema,
  inputHash: sha256Schema,
  projectionHash: sha256Schema,
  sourceCount: z.number().int().positive(),
  selectedCount: z.number().int().positive(),
  publishedCount: z.number().int().positive(),
  excludedCount: z.number().int().nonnegative(),
  excludedByReason: z.record(z.string(), z.number().int().nonnegative()),
  silentDropCount: z.literal(0),
  categoryCounts: z.object({
    identity: categoryCountSchema,
    project: categoryCountSchema,
    knowledge: categoryCountSchema,
    practice: categoryCountSchema,
  }),
  findings: z.object({
    secretFindings: z.literal(0),
    privacyFindings: z.literal(0),
    confidentialityFindings: z.literal(0),
    unsupportedClaimFindings: z.literal(0),
  }),
  sources: z.array(sourceManifestSchema).min(1),
  records: z.array(recordManifestSchema).min(1),
});
