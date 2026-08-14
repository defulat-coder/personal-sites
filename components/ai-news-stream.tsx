"use client";

import { ArrowUpRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import {
  formatAiNewsClock,
  getAiNewsCategoryLabel,
  groupAiNewsByDay,
  listAiNewsCategories,
} from "@/lib/ai-news-types";
import type { AiNewsListItem } from "@/lib/ai-news-types";

import { observeCurationScrollEnd } from "./curation-scroll";

type AiNewsPageResponse = {
  error?: string;
  hasMore: boolean;
  items: AiNewsListItem[];
};

type AiNewsStreamProps = {
  active?: boolean;
  initialHasMore: boolean;
  initialItems: AiNewsListItem[];
};

const PAGE_SIZE = 50;

export function AiNewsStream({ active = true, initialHasMore, initialItems }: AiNewsStreamProps) {
  const streamRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState(initialItems);
  const [appendStart, setAppendStart] = useState(initialItems.length);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (!active || isLoading || !hasMore) return;

    setIsLoading(true);
    setLoadError(null);
    setAppendStart(items.length);
    try {
      const response = await fetch(`/api/ai-news?offset=${items.length}&limit=${PAGE_SIZE}`);
      const payload = (await response.json()) as AiNewsPageResponse;
      if (!response.ok) throw new Error(payload.error ?? "暂时无法加载更多每日动态。");

      setItems((currentItems) => {
        const knownIds = new Set(currentItems.map((item) => item.id));
        return [...currentItems, ...payload.items.filter((item) => !knownIds.has(item.id))];
      });
      setHasMore(payload.hasMore);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "暂时无法加载更多每日动态。");
    } finally {
      setIsLoading(false);
    }
  }, [active, hasMore, isLoading, items.length]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!active || !hasMore || !stream) return;

    return observeCurationScrollEnd(stream, () => void loadMore());
  }, [active, hasMore, loadMore]);

  const categories = useMemo(() => listAiNewsCategories(items), [items]);
  const hasSelected = useMemo(() => items.some((item) => item.selected), [items]);
  const itemIndex = useMemo(() => new Map(items.map((item, index) => [item.id, index])), [items]);
  const activeFilterLabel = activeCategory === "selected"
    ? "精选"
    : activeCategory
      ? getAiNewsCategoryLabel(activeCategory)
      : null;
  const groups = useMemo(() => {
    const visible = activeCategory === "selected"
      ? items.filter((item) => item.selected)
      : activeCategory
        ? items.filter((item) => item.category === activeCategory)
        : items;
    return groupAiNewsByDay(visible);
  }, [activeCategory, items]);

  if (initialItems.length === 0) {
    return (
      <ol className="curation-home__stream">
        <li aria-live="polite" className="curation-home__stream-status">
          <span>暂时无法获取每日动态，稍后再来看看。</span>
        </li>
      </ol>
    );
  }

  return (
    <div ref={streamRef}>
      {categories.length > 1 ? (
        <div className="ai-news__filters" role="group" aria-label="按分类筛选">
          <button
            aria-pressed={activeCategory === null}
            className="curation-tag"
            data-active={activeCategory === null || undefined}
            onClick={() => setActiveCategory(null)}
            type="button"
          >
            全部
          </button>
          {hasSelected ? (
            <button
              aria-pressed={activeCategory === "selected"}
              className="curation-tag"
              data-active={activeCategory === "selected" || undefined}
              onClick={() => setActiveCategory(activeCategory === "selected" ? null : "selected")}
              type="button"
            >
              精选
            </button>
          ) : null}
          {categories.map((category) => (
            <button
              aria-pressed={activeCategory === category.id}
              className="curation-tag"
              data-active={activeCategory === category.id || undefined}
              key={category.id}
              onClick={() => setActiveCategory(category.id === activeCategory ? null : category.id)}
              type="button"
            >
              {category.label}
            </button>
          ))}
        </div>
      ) : null}

      {groups.map((group) => (
        <section aria-label={group.label} className="ai-news__day" key={group.dayKey || "unknown"}>
          <h2 className="ai-news__day-heading">
            <span className="ai-news__day-label">{group.label}</span>
            <span className="ai-news__day-meta">
              {group.weekday ? `${group.weekday} · ` : ""}{group.items.length} 条
            </span>
          </h2>
          <ol className="ai-news__timeline">
            {group.items.map((item) => {
              const index = itemIndex.get(item.id) ?? 0;
              const isAppended = index >= appendStart;
              return (
                <li
                  data-appended={isAppended ? "" : undefined}
                  key={item.id}
                  style={isAppended ? { "--stream-i": Math.min(index - appendStart, 9) } as CSSProperties : undefined}
                >
                  <Link className="ai-news__entry" data-content-id={item.id} href={`/ai-news/${item.id}` as Route}>
                    <div className="ai-news__entry-copy">
                      <div className="ai-news__entry-meta">
                        <time dateTime={item.publishedAt ?? undefined}>{formatAiNewsClock(item.publishedAt)}</time>
                        <span>{item.sourceName}</span>
                        <span>{getAiNewsCategoryLabel(item.category)}</span>
                        {item.selected ? <span>精选</span> : null}
                      </div>
                      <h3>{item.title}</h3>
                      {item.summary ? <p>{item.summary}</p> : null}
                    </div>
                    <span aria-hidden="true" className="ai-news__entry-arrow"><ArrowUpRight /></span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {groups.length === 0 ? (
        <p className="curation-feed__empty">这个分类下暂时没有每日动态。</p>
      ) : null}

      <div aria-live="polite" className="ai-news__status">
        <span className="sr-only">{activeFilterLabel ? `正在显示${activeFilterLabel}动态` : "正在显示全部动态"}</span>
        {isLoading ? (
          <>
            <span className="sr-only">正在加载更多内容</span>
            <div aria-hidden="true" className="curation-home__stream-skeleton">
              <span />
              <span className="is-medium" />
              <span className="is-short" />
            </div>
          </>
        ) : null}
        {loadError ? <button onClick={() => void loadMore()} type="button">{loadError}，重试</button> : null}
        {!hasMore && !loadError ? <span>已加载最近 7 天的全部动态</span> : null}
      </div>
    </div>
  );
}
