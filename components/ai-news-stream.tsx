"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  formatAiNewsClock,
  getAiNewsCategoryLabel,
  groupAiNewsByDay,
  listAiNewsCategories,
} from "@/lib/ai-news-types";
import type { AiNewsListItem } from "@/lib/ai-news-types";

import { observeCurationScrollEnd, getCurationScrollTarget } from "./curation-scroll";

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
const STREAM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
// 筛选切换时从头揭示的行数：与滚动追加共用 0.45rem 上浮 + 32ms 阶梯的语言，
// 只揭示首屏可见的前几行，其余行直接呈现，避免长列表整体延迟。
const FILTER_REVEAL_COUNT = 8;

export function AiNewsStream({ active = true, initialHasMore, initialItems }: AiNewsStreamProps) {
  const streamRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [items, setItems] = useState(initialItems);
  const [appendStart, setAppendStart] = useState(initialItems.length);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  // 筛选版本号：> 0 表示列表是筛选后的客户端重挂载，首行阶梯揭示只在这种挂载上播。
  const [filterVersion, setFilterVersion] = useState(0);

  const selectCategory = (next: string | null) => {
    setActiveCategory(next);
    setFilterVersion((version) => version + 1);
  };

  // 筛选后内容整体变了，把滚动位置收回顶部，让逐行揭示从第一行开始可见。
  useEffect(() => {
    if (filterVersion === 0) return;
    const stream = streamRef.current;
    if (!stream) return;
    getCurationScrollTarget(stream).scrollTo({
      behavior: reduceMotion ? "auto" : "smooth",
      top: 0,
    });
  }, [filterVersion, reduceMotion]);

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
          {/* 激活指示器是一条 1px 细线，用 layoutId 在筛选项之间滑动——
              与全站「细线即层级」的语言一致，reduced-motion 下时长归零。 */}
          <button
            aria-pressed={activeCategory === null}
            className="ai-news__filter"
            onClick={() => selectCategory(null)}
            type="button"
          >
            全部
            {activeCategory === null ? (
              <motion.span
                className="ai-news__filter-indicator"
                layoutId="ai-news-filter-indicator"
                transition={{ duration: reduceMotion ? 0 : 0.24, ease: STREAM_EASE }}
              />
            ) : null}
          </button>
          {hasSelected ? (
            <button
              aria-pressed={activeCategory === "selected"}
              className="ai-news__filter"
              onClick={() => selectCategory(activeCategory === "selected" ? null : "selected")}
              type="button"
            >
              精选
              {activeCategory === "selected" ? (
                <motion.span
                  className="ai-news__filter-indicator"
                  layoutId="ai-news-filter-indicator"
                  transition={{ duration: reduceMotion ? 0 : 0.24, ease: STREAM_EASE }}
                />
              ) : null}
            </button>
          ) : null}
          {categories.map((category) => (
            <button
              aria-pressed={activeCategory === category.id}
              className="ai-news__filter"
              key={category.id}
              onClick={() => selectCategory(category.id === activeCategory ? null : category.id)}
              type="button"
            >
              {category.label}
              {activeCategory === category.id ? (
                <motion.span
                  className="ai-news__filter-indicator"
                  layoutId="ai-news-filter-indicator"
                  transition={{ duration: reduceMotion ? 0 : 0.24, ease: STREAM_EASE }}
                />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {/* key 随筛选变化强制整列重挂载，首行阶梯揭示才有机会播放；
          不做整列 FLIP——数百行的位移动画会拉伸刊头、闪出大片空白。 */}
      <div key={activeCategory ?? "all"}>
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
              const isFilterReveal = filterVersion > 0 && index < FILTER_REVEAL_COUNT;
              const animateMount = !reduceMotion && (isAppended || isFilterReveal);
              const mountDelay = isAppended
                ? Math.min(index - appendStart, 9) * 0.032
                : index * 0.032;
              // 首屏 SSR 与筛选重挂载的非揭示行保持静态；追加行与筛选揭示行播放入场阶梯。
              return (
                <motion.li
                  animate={{ opacity: 1, y: 0 }}
                  initial={animateMount ? { opacity: 0, y: "0.45rem" } : false}
                  key={item.id}
                  transition={{
                    delay: animateMount ? mountDelay : 0,
                    duration: 0.3,
                    ease: STREAM_EASE,
                  }}
                >
                  <Link className="ai-news__entry" data-content-id={item.id} href={`/ai-news/${item.id}` as Route}>
                    <div className="ai-news__entry-meta">
                      <time dateTime={item.publishedAt ?? undefined}>{formatAiNewsClock(item.publishedAt)}</time>
                      {/* 登记列只保留出处名；(@handle) 会撑高左栏，详情页仍展示完整出处。 */}
                      <span>{item.sourceName.replace(/\s*\(@[^)]+\)\s*$/, "")}</span>
                      <span>{getAiNewsCategoryLabel(item.category)}</span>
                      {item.selected ? <span>精选</span> : null}
                    </div>
                    <div className="ai-news__entry-copy">
                      <h3>{item.title}</h3>
                      {item.summary ? <p>{item.summary}</p> : null}
                    </div>
                  </Link>
                </motion.li>
              );
            })}
          </ol>
        </section>
        ))}
      </div>

      {groups.length === 0 ? (
        <motion.p
          animate={{ opacity: 1 }}
          className="ai-news__empty"
          initial={reduceMotion ? false : { opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          这个分类下暂时没有每日动态。
        </motion.p>
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
        {!hasMore && !loadError ? (
          <span>{activeFilterLabel ? `已加载全部${activeFilterLabel}动态` : "已加载最近 7 天的全部动态"}</span>
        ) : null}
      </div>
    </div>
  );
}
