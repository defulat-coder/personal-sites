import { z } from "zod";

import type { CurationListItem } from "@/lib/curation-types";

// 策展流的会话快照：返回详情再退回列表时，恢复已加载的分页与滚动位置。
// 与 ai-news-stream-snapshot 同一套约定——桌面端真正滚动的是 .curation-home__feed 自定义容器，
// Next 的滚动恢复只管 window，分页数据又只在组件 state 里，所以快照同时保存两者。
export type CurationStreamSnapshot = {
  hasMore: boolean;
  items: CurationListItem[];
  savedAt: number;
  scrollTop: number;
};

const STORAGE_KEY = "curation-stream-v1";
// 只保留最近这么多条：足够覆盖几次「加载更多」，又不至于撑爆 sessionStorage。
const MAX_SNAPSHOT_ITEMS = 400;
// 快照有效期：超过这个时间即使首条 id 一致也不再恢复，隔太久的会话从头看更合理。
const SNAPSHOT_TTL_MS = 30 * 60 * 1000;

const listItemSchema = z.object({
  attachments: z.array(z.string()),
  author: z.object({ handle: z.string(), name: z.string() }),
  collectedAt: z.string().nullable(),
  design: z.object({
    categories: z.array(z.string()),
    classifiedAt: z.string(),
    confidence: z.number(),
    evidence: z.array(z.string()),
    reason: z.string(),
    relevant: z.boolean(),
    status: z.enum(["include", "review", "exclude"]),
  }).nullable(),
  id: z.string().min(1),
  media: z.array(z.object({
    durationMs: z.number().nullable(),
    height: z.number().nullable(),
    previewUrl: z.string().nullable(),
    type: z.enum(["photo", "video", "animated_gif"]),
    url: z.string(),
    videoUrl: z.string().nullable(),
    width: z.number().nullable(),
  })),
  publishedAt: z.string().nullable(),
  source: z.object({ label: z.string(), platform: z.enum(["douyin", "x"]), url: z.string().url() }),
  summary: z.string(),
  tags: z.array(z.string()),
  text: z.string(),
  title: z.string(),
});

const snapshotSchema = z.object({
  hasMore: z.boolean(),
  items: z.array(listItemSchema).min(1),
  savedAt: z.number(),
  scrollTop: z.number().min(0),
});

export function toCurationStreamSnapshot(
  state: {
    hasMore: boolean;
    items: CurationListItem[];
    scrollTop: number;
  },
  now = Date.now(),
): CurationStreamSnapshot {
  return { ...state, items: state.items.slice(0, MAX_SNAPSHOT_ITEMS), savedAt: now };
}

/**
 * 解析并校验快照：只在快照首条与当前 SSR 首条 id 一致（数据集没变）且未过期时返回，
 * 其余情况（解析失败、结构不符、列表头部已更新、超过有效期）一律返回 null。
 */
export function fromCurationStreamSnapshot(
  raw: string | null,
  headId: string | undefined,
  now = Date.now(),
): CurationStreamSnapshot | null {
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

export function writeCurationStreamSnapshot(snapshot: CurationStreamSnapshot, storageKey = STORAGE_KEY) {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
  } catch {
    // 隐私模式或配额满时静默放弃，快照只是体验增强。
  }
}

export function readCurationStreamSnapshot(headId: string | undefined, storageKey = STORAGE_KEY): CurationStreamSnapshot | null {
  try {
    return fromCurationStreamSnapshot(window.sessionStorage.getItem(storageKey), headId);
  } catch {
    return null;
  }
}
