import { z } from "zod";

import { aiNewsItemContentSchema } from "@/lib/ai-news-types";
import type { AiNewsListItem } from "@/lib/ai-news-types";

// 每日动态流的会话快照：返回详情再退回列表时，恢复已加载的分页与滚动位置。
// 桌面端真正滚动的是 .curation-home__feed 自定义容器，Next 的滚动恢复只管 window，
// 而分页数据又只在组件 state 里——所以快照同时保存两者，用 sessionStorage 随会话消亡。
export type AiNewsStreamSnapshot = {
  activeCategory: string | null;
  hasMore: boolean;
  items: AiNewsListItem[];
  savedAt: number;
  scrollTop: number;
};

const STORAGE_KEY = "ai-news-stream-v1";
// 只保留最近这么多条：足够覆盖几次「加载更多」，又不至于撑爆 sessionStorage。
const MAX_SNAPSHOT_ITEMS = 400;
// 快照有效期：超过这个时间即使首条 id 一致也不再恢复，隔太久的会话从头看更合理。
const SNAPSHOT_TTL_MS = 30 * 60 * 1000;

const listItemSchema = aiNewsItemContentSchema
  .omit({ reason: true, score: true, url: true })
  .extend({ selected: z.boolean() });

const snapshotSchema = z.object({
  activeCategory: z.string().nullable(),
  hasMore: z.boolean(),
  items: z.array(listItemSchema).min(1),
  savedAt: z.number(),
  scrollTop: z.number().min(0),
});

export function toAiNewsStreamSnapshot(
  state: {
    activeCategory: string | null;
    hasMore: boolean;
    items: AiNewsListItem[];
    scrollTop: number;
  },
  now = Date.now(),
): AiNewsStreamSnapshot {
  return { ...state, items: state.items.slice(0, MAX_SNAPSHOT_ITEMS), savedAt: now };
}

/**
 * 解析并校验快照：只在快照首条与当前 SSR 首条 id 一致（数据集没变）且未过期时返回，
 * 其余情况（解析失败、结构不符、列表头部已更新、超过有效期）一律返回 null。
 */
export function fromAiNewsStreamSnapshot(
  raw: string | null,
  headId: string | undefined,
  now = Date.now(),
): AiNewsStreamSnapshot | null {
  if (!raw || !headId) return null;
  try {
    const parsed = snapshotSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const snapshot = parsed.data;
    if (snapshot.items[0].id !== headId) return null;
    if (now - snapshot.savedAt > SNAPSHOT_TTL_MS) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export function writeAiNewsStreamSnapshot(snapshot: AiNewsStreamSnapshot) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // 隐私模式或配额满时静默放弃，快照只是体验增强。
  }
}

export function readAiNewsStreamSnapshot(headId: string | undefined): AiNewsStreamSnapshot | null {
  try {
    return fromAiNewsStreamSnapshot(window.sessionStorage.getItem(STORAGE_KEY), headId);
  } catch {
    return null;
  }
}
