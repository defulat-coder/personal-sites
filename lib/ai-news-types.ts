import { z } from "zod";

// 每日动态公开投影（Supabase ai_news_public_items.content）的结构；
// 页面只消费同步进来的底层数据，不出现上游来源标识。
export type AiNewsItem = {
  category: string;
  id: string;
  publishedAt: string | null;
  reason: string;
  score: number | null;
  selected: boolean;
  sourceName: string;
  summary: string;
  title: string;
  url: string;
};

// 列表页只需要这些字段；reason/score/url 仅详情页使用，列表查询做字段投影剔除。
export type AiNewsListItem = Omit<AiNewsItem, "reason" | "score" | "url">;

export const aiNewsItemContentSchema = z.object({
  category: z.string(),
  id: z.string().min(1),
  publishedAt: z.string().nullable(),
  reason: z.string(),
  score: z.number().nullable(),
  sourceName: z.string(),
  summary: z.string(),
  title: z.string().min(1),
  url: z.string().url(),
});

const aiNewsCategoryLabels: Record<string, string> = {
  "ai-models": "模型",
  "ai-products": "产品",
  industry: "行业",
  paper: "论文",
  tip: "教程",
};

const aiNewsCategoryOrder = ["ai-models", "ai-products", "industry", "paper", "tip"];

export function getAiNewsCategoryLabel(category: string) {
  return aiNewsCategoryLabels[category] ?? category;
}

/** 按固定分类顺序列出当前条目里实际出现的分类，供列表页筛选。 */
export function listAiNewsCategories(items: Pick<AiNewsItem, "category">[]) {
  const present = new Set(items.map((item) => item.category).filter(Boolean));
  const ordered = aiNewsCategoryOrder.filter((category) => present.has(category));
  const rest = [...present].filter((category) => !aiNewsCategoryOrder.includes(category)).sort();
  return [...ordered, ...rest].map((id) => ({ id, label: getAiNewsCategoryLabel(id) }));
}

const shanghaiDay = new Intl.DateTimeFormat("zh-CN", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Shanghai",
  year: "numeric",
});

const shanghaiClock = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Shanghai",
});

const shanghaiWeekday = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  weekday: "long",
});

/** 北京时间日期分组的 key（YYYY-MM-DD）；无发布时间返回空串。 */
export function getAiNewsDayKey(publishedAt: string | null) {
  if (!publishedAt) return "";
  const parts = shanghaiDay.formatToParts(new Date(publishedAt));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatAiNewsTime(publishedAt: string | null) {
  if (!publishedAt) return "时间待定";
  return new Intl.DateTimeFormat("zh-CN", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "long",
    timeZone: "Asia/Shanghai",
  }).format(new Date(publishedAt));
}

export function formatAiNewsClock(publishedAt: string | null) {
  if (!publishedAt) return "--:--";
  return shanghaiClock.format(new Date(publishedAt));
}

export type AiNewsDayGroup<T extends Pick<AiNewsItem, "publishedAt"> = AiNewsItem> = {
  dayKey: string;
  items: T[];
  label: string;
  weekday: string;
};

/** 按北京时间日期倒序分组；无发布时间的条目排在最后的「时间待定」组。 */
export function groupAiNewsByDay<T extends Pick<AiNewsItem, "publishedAt">>(items: T[]): AiNewsDayGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getAiNewsDayKey(item.publishedAt);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === "") return 1;
      if (b === "") return -1;
      return b.localeCompare(a);
    })
    .map(([dayKey, groupItems]) => ({
      dayKey,
      items: groupItems,
      label: dayKey ? `${Number(dayKey.slice(5, 7))}月${Number(dayKey.slice(8, 10))}日` : "时间待定",
      weekday: dayKey ? shanghaiWeekday.format(new Date(`${dayKey}T12:00:00+08:00`)) : "",
    }));
}

export function formatAiNewsRelativeTime(publishedAt: string | null, now: number = Date.now()) {
  if (!publishedAt) return null;
  const diff = now - new Date(publishedAt).getTime();
  if (Number.isNaN(diff) || diff < 0) return null;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

export function getAiNewsUrlHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// 原文按钮按平台措辞，与原文所在的站点一致。
export function getAiNewsOriginalAction(url: string) {
  const host = getAiNewsUrlHost(url);
  if (host === "x.com" || host === "twitter.com") return "在 X 查看原推";
  if (host === "mp.weixin.qq.com") return "在微信查看原文";
  if (host === "github.com") return "在 GitHub 查看";
  return "查看原文";
}
