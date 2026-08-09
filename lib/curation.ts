import { z } from "zod";

import curationProjection from "@/data/public/curation.json";

const curationItemSchema = z.object({
  analysis: z.string().min(1),
  author: z.object({
    handle: z.string(),
    name: z.string(),
  }),
  id: z.string().min(1),
  links: z.array(
    z.object({
      shortUrl: z.string().url().nullable(),
      type: z.string().min(1),
      url: z.string().url(),
    }),
  ),
  media: z.array(
    z.object({
      height: z.number().int().positive().nullable(),
      previewUrl: z.string().url().nullable(),
      type: z.enum(["photo", "video", "animated_gif"]),
      url: z.string().url(),
      width: z.number().int().positive().nullable(),
    }),
  ),
  publishedAt: z.string().datetime().nullable(),
  quoteContext: z
    .object({
      author: z.string(),
      authorName: z.string(),
      text: z.string(),
    })
    .nullable(),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  text: z.string().min(1),
  title: z.string().min(1),
  tweetUrl: z.string().url(),
});

const curationProjectionSchema = z.object({
  generatedAt: z.string().datetime(),
  items: z.array(curationItemSchema),
  version: z.literal(1),
});

export const curationContent = curationProjectionSchema.parse(curationProjection);

export type CurationItem = z.infer<typeof curationItemSchema>;

export const curationItems = curationContent.items;

export const curationTags = [
  ...new Set(curationItems.flatMap((item) => item.tags)),
].sort((a, b) => a.localeCompare(b, "zh-CN"));

export function findCurationItem(id: string) {
  return curationItems.find((item) => item.id === id) ?? null;
}

export function formatCurationDate(item: CurationItem) {
  if (!item.publishedAt) return "日期待定";
  return new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(new Date(item.publishedAt));
}
