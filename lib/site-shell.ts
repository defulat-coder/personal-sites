import { z } from "zod";

const shellAnchorSchema = z.enum(["projects", "knowledge", "practice", "about"]);

const shellNavigationItemSchema = z.object({
  anchor: shellAnchorSchema,
  href: z.string().regex(/^#[a-z-]+$/u),
  label: z.string().min(1),
});

const shellExternalLinkSchema = z.object({
  href: z.string().url(),
  label: z.string().min(1),
});

export const siteShellSchema = z
  .object({
    brand: z.object({
      label: z.literal("陈远"),
    }),
    externalLinks: z.array(shellExternalLinkSchema).length(2),
    navigation: z.array(shellNavigationItemSchema).length(4),
    version: z.literal(3),
  })
  .superRefine((value, context) => {
    const anchors = value.navigation.map((item) => item.anchor);
    if (new Set(anchors).size !== anchors.length) {
      context.addIssue({
        code: "custom",
        message: "Shell navigation anchors must be unique",
        path: ["navigation"],
      });
    }
    for (const item of value.navigation) {
      if (item.href !== `#${item.anchor}`) {
        context.addIssue({
          code: "custom",
          message: `Navigation href must target ${item.anchor}`,
          path: ["navigation"],
        });
      }
    }
  });

export const siteShell = siteShellSchema.parse({
  brand: {
    label: "陈远",
  },
  externalLinks: [
    { href: "https://github.com/defulat-coder", label: "GitHub" },
    { href: "https://www.yuque.com/defulat-coder", label: "语雀" },
  ],
  navigation: [
    { anchor: "projects", href: "#projects", label: "项目" },
    { anchor: "knowledge", href: "#knowledge", label: "知识" },
    { anchor: "practice", href: "#practice", label: "实践" },
    { anchor: "about", href: "#about", label: "关于" },
  ],
  version: 3,
});

export type SiteShell = z.infer<typeof siteShellSchema>;
