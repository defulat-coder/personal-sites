import type { Route } from "next";
import Link from "next/link";

import { formatAiNewsClock, groupAiNewsByDay } from "@/lib/ai-news-types";
import type { AiNewsListItem } from "@/lib/ai-news-types";
import type { CurationListItem } from "@/lib/curation-types";
import type { OpenSourceListEntry } from "@/lib/open-source-types";

type SnapshotKind = "ai-news" | "daily" | "open-source";

type SnapshotEntry = {
  href: Route;
  id: string;
  kind: SnapshotKind;
  publishedAt: string | null;
  selected: boolean;
  timeLabel: string | null;
  title: string;
  ts: number;
};

const kindLabels: Record<SnapshotKind, string> = {
  "ai-news": "动态",
  daily: "点赞",
  "open-source": "开源",
};

// 快照只证明"跨类型的每日节奏"：取最近几天，每日限量，
// 每日动态体量远大于另两条流，超额时优先保留非动态条目与精选。
const SNAPSHOT_DAY_LIMIT = 5;
const SNAPSHOT_DAY_ENTRY_LIMIT = 8;

function toTimestamp(value: string | null) {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function capSnapshotDay(entries: SnapshotEntry[]) {
  const sorted = [...entries].sort((a, b) => b.ts - a.ts);
  if (sorted.length <= SNAPSHOT_DAY_ENTRY_LIMIT) return sorted;
  const priority = sorted.filter((entry) => entry.kind !== "ai-news" || entry.selected);
  const filler = sorted.filter((entry) => entry.kind === "ai-news" && !entry.selected);
  return [...priority, ...filler].slice(0, SNAPSHOT_DAY_ENTRY_LIMIT).sort((a, b) => b.ts - a.ts);
}

type HomeSnapshotProps = {
  aiNewsItems: AiNewsListItem[];
  curationItems: CurationListItem[];
  openSourceEntries: OpenSourceListEntry[];
};

export function HomeSnapshot({ aiNewsItems, curationItems, openSourceEntries }: HomeSnapshotProps) {
  const entries: SnapshotEntry[] = [
    ...aiNewsItems.map((item) => ({
      href: `/ai-news/${item.id}` as Route,
      id: `ai-news-${item.id}`,
      kind: "ai-news" as const,
      publishedAt: item.publishedAt,
      selected: item.selected,
      timeLabel: formatAiNewsClock(item.publishedAt),
      title: item.title,
      ts: toTimestamp(item.publishedAt),
    })),
    ...curationItems.map((item) => {
      const publishedAt = item.publishedAt ?? item.collectedAt ?? null;
      return {
        href: `/curation/${item.id}` as Route,
        id: `daily-${item.id}`,
        kind: "daily" as const,
        publishedAt,
        selected: false,
        timeLabel: publishedAt ? formatAiNewsClock(publishedAt) : null,
        title: item.title,
        ts: toTimestamp(publishedAt),
      };
    }),
    ...openSourceEntries.map((entry) => ({
      href: `/open-source/${entry.slug}` as Route,
      id: `open-source-${entry.slug}`,
      kind: "open-source" as const,
      publishedAt: entry.checkedAt,
      selected: false,
      timeLabel: null,
      title: entry.repository,
      ts: toTimestamp(entry.checkedAt),
    })),
  ];

  const days = groupAiNewsByDay(entries)
    .slice(0, SNAPSHOT_DAY_LIMIT)
    .map((group) => ({ ...group, items: capSnapshotDay(group.items) }))
    .filter((group) => group.items.length > 0);

  if (days.length === 0) {
    return <p className="home-snapshot__empty">最近没有新的内容，稍后再来看看。</p>;
  }

  return (
    <div className="home-snapshot">
      {days.map((group) => (
        <section aria-label={group.label} className="ai-news__day" key={group.dayKey || "unknown"}>
          <h2 className="ai-news__day-heading">
            <span className="ai-news__day-label">{group.label}</span>
            <span className="ai-news__day-meta">
              {group.weekday ? `${group.weekday} · ` : ""}{group.items.length} 条
            </span>
          </h2>
          <ol className="home-snapshot__list">
            {group.items.map((entry) => (
              <li key={entry.id}>
                <Link className="home-snapshot__entry" href={entry.href}>
                  <div className="home-snapshot__meta">
                    <span className="home-snapshot__kind">{kindLabels[entry.kind]}</span>
                    {entry.timeLabel ? <span>{entry.timeLabel}</span> : null}
                  </div>
                  <h3>{entry.title}</h3>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
