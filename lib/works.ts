import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import type { Work, WorkEntry } from "@/lib/works-types";

// 构建版块的内容由作者亲手维护、随仓库发布，不走 Supabase 管线——
// 内容与代码同库本身就是「内容即证据」的一部分。
const worksDirectory = path.join(process.cwd(), "content", "works");

const frontmatterSchema = z.object({
  order: z.coerce.number().int().default(100),
  period: z.string().min(1),
  role: z.string().min(1),
  stack: z.string().min(1),
  status: z.string().min(1),
  summary: z.string().min(1),
  title: z.string().min(1),
  repo: z.string().optional(),
  url: z.string().optional(),
});

/** 解析单篇构建文档：frontmatter 只支持单行 `key: value`，正文为 Markdown。 */
export function parseWorkDocument(slug: string, raw: string): Work {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/u.exec(raw);
  if (!match) {
    throw new Error(`构建条目 ${slug} 缺少 frontmatter`);
  }
  const [, frontmatterBlock, body] = match;
  const fields: Record<string, string> = {};
  for (const line of frontmatterBlock.split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    fields[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  const frontmatter = frontmatterSchema.parse(fields);
  return {
    body: body.trim(),
    order: frontmatter.order,
    period: frontmatter.period,
    role: frontmatter.role,
    slug,
    stack: frontmatter.stack.split(/[,，]/u).map((item) => item.trim()).filter(Boolean),
    status: frontmatter.status,
    summary: frontmatter.summary,
    title: frontmatter.title,
    ...(frontmatter.repo ? { repo: frontmatter.repo } : {}),
    ...(frontmatter.url ? { url: frontmatter.url } : {}),
  };
}

export async function listWorks(): Promise<WorkEntry[]> {
  const files = await readdir(worksDirectory);
  const entries = await Promise.all(
    files
      .filter((file) => file.endsWith(".md"))
      .map(async (file) => {
        const raw = await readFile(path.join(worksDirectory, file), "utf8");
        const { body, ...entry } = parseWorkDocument(file.replace(/\.md$/u, ""), raw);
        void body;
        return entry;
      }),
  );
  return entries.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

export async function getWork(slug: string): Promise<Work | null> {
  if (!/^[\w-]+$/u.test(slug)) return null;
  try {
    const raw = await readFile(path.join(worksDirectory, `${slug}.md`), "utf8");
    return parseWorkDocument(slug, raw);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
