import { z } from "zod";

export const siteFoundationSchema = z.object({
  packageManager: z.literal("pnpm"),
  runtime: z.literal("nextjs"),
  version: z.literal(1),
});

export const siteFoundation = siteFoundationSchema.parse({
  packageManager: "pnpm",
  runtime: "nextjs",
  version: 1,
});
