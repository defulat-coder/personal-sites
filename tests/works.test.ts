import { describe, expect, it } from "vitest";

import { parseWorkDocument } from "@/lib/works";

const validDocument = `---
title: 这个站点本身
period: 2025 — 至今
status: 持续维护
role: 独立设计与开发
summary: 一句话定位。
stack: Next.js, Supabase, Kimi
order: 1
---

## 为什么

正文内容。
`;

describe("parseWorkDocument", () => {
  it("parses frontmatter fields and markdown body", () => {
    const work = parseWorkDocument("personal-site", validDocument);
    expect(work).toMatchObject({
      order: 1,
      period: "2025 — 至今",
      role: "独立设计与开发",
      slug: "personal-site",
      status: "持续维护",
      summary: "一句话定位。",
      title: "这个站点本身",
    });
    expect(work.stack).toEqual(["Next.js", "Supabase", "Kimi"]);
    expect(work.body).toContain("## 为什么");
  });

  it("defaults order when omitted and splits stack on Chinese commas", () => {
    const raw = validDocument
      .replace("order: 1\n", "")
      .replace("Next.js, Supabase, Kimi", "Next.js，Supabase");
    const work = parseWorkDocument("demo", raw);
    expect(work.order).toBe(100);
    expect(work.stack).toEqual(["Next.js", "Supabase"]);
  });

  it("rejects documents without frontmatter", () => {
    expect(() => parseWorkDocument("broken", "没有 frontmatter")).toThrow(/frontmatter/u);
  });

  it("rejects documents missing required fields", () => {
    const raw = validDocument.replace("summary: 一句话定位。\n", "");
    expect(() => parseWorkDocument("broken", raw)).toThrow();
  });

  it("parses shots as label|path pairs and defaults to an empty list", () => {
    expect(parseWorkDocument("personal-site", validDocument).shots).toEqual([]);

    const raw = validDocument.replace(
      "order: 1",
      "shots: 每日动态|/images/works/demo/feed.png, 问一问|/images/works/demo/ask.png\norder: 1",
    );
    expect(parseWorkDocument("personal-site", raw).shots).toEqual([
      { label: "每日动态", src: "/images/works/demo/feed.png" },
      { label: "问一问", src: "/images/works/demo/ask.png" },
    ]);
  });

  it("rejects shots entries without a label|path shape or a site-absolute path", () => {
    const missingSeparator = validDocument.replace("order: 1", "shots: 只有标注\norder: 1");
    expect(() => parseWorkDocument("broken", missingSeparator)).toThrow(/shots/u);

    const externalSrc = validDocument.replace("order: 1", "shots: 外部|https://example.com/a.png\norder: 1");
    expect(() => parseWorkDocument("broken", externalSrc)).toThrow(/shots/u);
  });
});
