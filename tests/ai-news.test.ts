import { describe, expect, it } from "vitest";

import {
  aiNewsItemContentSchema,
  formatAiNewsClock,
  formatAiNewsRelativeTime,
  formatAiNewsTime,
  getAiNewsCategoryLabel,
  getAiNewsOriginalAction,
  groupAiNewsByDay,
  listAiNewsCategories,
} from "../lib/ai-news-types";
import type { AiNewsItem } from "../lib/ai-news-types";

const sampleItem: AiNewsItem = {
  category: "ai-models",
  id: "cmssv94cg0h4mroffsb9e7a88",
  publishedAt: "2026-08-14T11:25:29.000Z",
  reason: "长程智能体方向值得关注。",
  score: 79,
  selected: true,
  sourceName: "公众号：小红书技术（dots.llm）",
  summary: "小红书技术开源 dots3-note Preview。",
  title: "dots3-note Preview 开源",
  url: "https://mp.weixin.qq.com/s/example",
};

describe("ai news", () => {
  it("validates the public projection stored in Supabase", () => {
    const content = aiNewsItemContentSchema.parse(sampleItem);
    expect(content).toMatchObject({ id: sampleItem.id, title: sampleItem.title, url: sampleItem.url });
    // selected 是公开表的列而不是 content 投影的字段
    expect(content).not.toHaveProperty("selected");
    expect(() => aiNewsItemContentSchema.parse({ ...sampleItem, url: "not-a-url" })).toThrow();
    expect(() => aiNewsItemContentSchema.parse({ ...sampleItem, id: "" })).toThrow();
  });

  it("maps known categories to Chinese labels and falls back to the raw slug", () => {
    expect(getAiNewsCategoryLabel("ai-models")).toBe("模型");
    expect(getAiNewsCategoryLabel("paper")).toBe("论文");
    expect(getAiNewsCategoryLabel("unknown")).toBe("unknown");
  });

  it("lists present categories in the fixed order", () => {
    const items = [
      { ...sampleItem, category: "industry", id: "a" },
      { ...sampleItem, category: "ai-models", id: "b" },
      { ...sampleItem, category: "industry", id: "c" },
    ];
    expect(listAiNewsCategories(items)).toEqual([
      { id: "ai-models", label: "模型" },
      { id: "industry", label: "行业" },
    ]);
    expect(listAiNewsCategories([])).toEqual([]);
  });

  it("groups items by Beijing calendar day in descending order", () => {
    const items = [
      { ...sampleItem, id: "early", publishedAt: "2026-08-14T13:30:00.000Z" }, // 北京时间 8月14日 21:30
      { ...sampleItem, id: "late", publishedAt: "2026-08-14T16:30:00.000Z" }, // 北京时间 8月15日 00:30
      { ...sampleItem, id: "unknown", publishedAt: null },
    ];
    const groups = groupAiNewsByDay(items);
    expect(groups.map((group) => group.dayKey)).toEqual(["2026-08-15", "2026-08-14", ""]);
    expect(groups[0].label).toBe("8月15日");
    expect(groups[0].weekday).toBe("星期六");
    expect(groups[0].items.map((item) => item.id)).toEqual(["late"]);
    expect(groups[2].label).toBe("时间待定");
  });

  it("formats clock, full time and relative time in Asia/Shanghai", () => {
    expect(formatAiNewsClock("2026-08-14T11:25:29.000Z")).toBe("19:25");
    expect(formatAiNewsClock(null)).toBe("--:--");
    expect(formatAiNewsTime("2026-08-14T11:25:29.000Z")).toBe("8月14日 19:25");
    expect(formatAiNewsTime(null)).toBe("时间待定");
    const now = new Date("2026-08-14T13:25:29.000Z").getTime();
    expect(formatAiNewsRelativeTime("2026-08-14T13:25:29.000Z", now)).toBe("刚刚");
    expect(formatAiNewsRelativeTime("2026-08-14T13:05:29.000Z", now)).toBe("20分钟前");
    expect(formatAiNewsRelativeTime("2026-08-14T10:25:29.000Z", now)).toBe("3小时前");
    expect(formatAiNewsRelativeTime("2026-08-12T13:25:29.000Z", now)).toBe("2天前");
    expect(formatAiNewsRelativeTime(null, now)).toBeNull();
    expect(formatAiNewsRelativeTime("2026-08-15T13:25:29.000Z", now)).toBeNull();
  });

  it("wording of the original-action button follows the source platform", () => {
    expect(getAiNewsOriginalAction("https://x.com/a/status/1")).toBe("在 X 查看原推");
    expect(getAiNewsOriginalAction("https://mp.weixin.qq.com/s?__biz=x")).toBe("在微信查看原文");
    expect(getAiNewsOriginalAction("https://github.com/a/b")).toBe("在 GitHub 查看");
    expect(getAiNewsOriginalAction("https://blog.example.com/post")).toBe("查看原文");
  });
});
