"use client";

import { useStreamDate } from "@/components/use-stream-date";
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { motion, useReducedMotion } from "motion/react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  formatAiNewsClock,
  getAiNewsCategoryLabel,
  groupAiNewsByDay,
  listAiNewsCategories,
} from "@/lib/ai-news-types";
import type { AiNewsListItem } from "@/lib/ai-news-types";

import {
  readAiNewsStreamSnapshot,
  toAiNewsStreamSnapshot,
  writeAiNewsStreamSnapshot,
} from "./ai-news-stream-snapshot";
import { observeCurationScrollEnd, getCurationScrollTarget } from "./curation-scroll";

type AiNewsPageResponse = {
  error?: string;
  hasMore: boolean;
  items: AiNewsListItem[];
};

type AiNewsStreamProps = {
  initialHasMore: boolean;
  initialItems: AiNewsListItem[];
};

const PAGE_SIZE = 50;
const STREAM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
// 筛选切换时从头揭示的行数：与滚动追加共用 0.45rem 上浮 + 32ms 阶梯的语言，
// 只揭示首屏可见的前几行，其余行直接呈现，避免长列表整体延迟。
const FILTER_REVEAL_COUNT = 8;

export function AiNewsStream({ initialHasMore, initialItems }: AiNewsStreamProps) {
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
  // 会话快照恢复：从详情页返回时把分页与滚动位置还原，避免列表从头开始。
  // restored 是一次性开关——恢复后的重渲染提交完成、DOM 行数齐全后再落滚动位置。
  const [restored, setRestored] = useState(false);
  const scrollTopRef = useRef(0);
  const restoreScrollTopRef = useRef(0);
  // 快照写入门闩：挂载提交期间（含 StrictMode 重放、dev 下的重挂载）禁止写快照——
  // 否则恢复读取之前，初始 SSR 状态会先把有效快照覆盖掉。挂载落定后由宏任务开门。
  const writesEnabledRef = useRef(false);
  const latestRef = useRef({ activeCategory, hasMore, items });

  // 仅挂载时执行：首渲染仍用 SSR 数据（无水合不一致），layout effect 里的
  // setState 会在绘制前同步重渲染，访客看不到从 50 条跳回完整列表的过程。
  useLayoutEffect(() => {
    const enableWrites = window.setTimeout(() => {
      writesEnabledRef.current = true;
    }, 0);
    if (!restored) {
      const snapshot = readAiNewsStreamSnapshot(initialItems[0]?.id);
      if (snapshot) {
        restoreScrollTopRef.current = snapshot.scrollTop;
        scrollTopRef.current = snapshot.scrollTop;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 恢复 sessionStorage 快照只能在挂载后做，layout effect 保证绘制前完成
        setItems(snapshot.items);
        setHasMore(snapshot.hasMore);
        setActiveCategory(snapshot.activeCategory);
        // 恢复的行全部视为非追加行，不重播入场阶梯。
        setAppendStart(snapshot.items.length);
        setRestored(true);
      }
    }
    return () => window.clearTimeout(enableWrites);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在挂载时尝试恢复一次
  }, []);

  useLayoutEffect(() => {
    if (!restored) return;
    const stream = streamRef.current;
    if (!stream) return;
    getCurationScrollTarget(stream).scrollTo({ behavior: "auto", top: restoreScrollTopRef.current });
  }, [restored]);

  // 跟踪滚动位置（rAF 节流的被动监听）；桌面端滚动容器是 .curation-home__feed，
  // 移动端是 window，统一经 getCurationScrollTarget 取值。
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const target = getCurationScrollTarget(stream);
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        scrollTopRef.current = target instanceof Window ? target.scrollY : target.scrollTop;
      });
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // 分页或筛选变化时持久化快照；滚动位置在写入时从 ref 取最新值。
  useEffect(() => {
    latestRef.current = { activeCategory, hasMore, items };
    if (!writesEnabledRef.current || items.length === 0) return;
    writeAiNewsStreamSnapshot(toAiNewsStreamSnapshot({
      activeCategory,
      hasMore,
      items,
      scrollTop: scrollTopRef.current,
    }));
  }, [activeCategory, hasMore, items]);

  // 路由离开（点进详情）时组件卸载，兜底写一次最终状态。
  useEffect(() => () => {
    if (!writesEnabledRef.current) return;
    const latest = latestRef.current;
    if (latest.items.length === 0) return;
    writeAiNewsStreamSnapshot(toAiNewsStreamSnapshot({ ...latest, scrollTop: scrollTopRef.current }));
  }, []);

  const selectCategory = (next: string | null) => {
    // 幂等：重复点击当前激活的筛选（含「全部」）不触发任何副作用（滚顶/揭示动画）。
    if (next === activeCategory) return;
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
    if (isLoading || !hasMore) return;

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
  }, [hasMore, isLoading, items.length]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!hasMore || !stream) return;

    return observeCurationScrollEnd(stream, () => void loadMore());
  }, [hasMore, loadMore]);

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
  // 筛选揭示用「过滤后展平序列」的序号而非全局索引：加载多页后，某分类的首批条目
  // 全局索引会整体越过 FILTER_REVEAL_COUNT 窗口，用全局索引判定等于静默禁用揭示。
  const filteredIndex = useMemo(() => {
    const index = new Map<string, number>();
    let position = 0;
    for (const group of groups) {
      for (const item of group.items) {
        index.set(item.id, position);
        position += 1;
      }
    }
    return index;
  }, [groups]);

  const visibleDay = useStreamDate(streamRef, groups);

  const visibleGroup = groups.find((group) => (group.dayKey || "unknown") === visibleDay) ?? groups[0];

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
    <div className="ai-news__stream" ref={streamRef}>
      <div className="stream-date-toolbar">
        <div className="ai-news__day-heading">
          <span className="ai-news__day-label">{visibleGroup?.label ?? "每日动态"}</span>
          {visibleGroup ? <span className="ai-news__day-meta">{visibleGroup.weekday} · {visibleGroup.items.length} 条</span> : null}
        </div>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button aria-label={`筛选每日动态：${activeFilterLabel ?? "全部动态"}`} className="ai-news__category-select" type="button">
            <span>{activeFilterLabel ?? "全部动态"}</span>
            <ChevronDown aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4} collisionPadding={16} className="ai-news__category-menu">
          <DropdownMenuRadioGroup value={activeCategory ?? "all"} onValueChange={(value) => selectCategory(value === "all" ? null : value)}>
            <DropdownMenuRadioItem value="all">全部动态</DropdownMenuRadioItem>
            {hasSelected ? <DropdownMenuRadioItem value="selected">精选动态</DropdownMenuRadioItem> : null}
            {categories.map((category) => <DropdownMenuRadioItem key={category.id} value={category.id}>{category.label}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>

      {/* key 随筛选变化强制整列重挂载，首行阶梯揭示才有机会播放；
          不做整列 FLIP——数百行的位移动画会拉伸刊头、闪出大片空白。 */}
      <div className="ai-news__groups" key={activeCategory ?? "all"}>
        {groups.map((group, groupIndex) => (
        <section aria-label={group.label} className="ai-news__day" data-stream-date={group.dayKey || "unknown"} key={group.dayKey || "unknown"}>
          <h2 className={groupIndex === 0 ? "sr-only" : "ai-news__day-heading"}>
            <span className="ai-news__day-label">{group.label}</span>
            <span className="ai-news__day-meta">
              {group.weekday ? `${group.weekday} · ` : ""}{group.items.length} 条
            </span>
          </h2>
          <ol className="ai-news__timeline">
            {group.items.map((item) => {
              const index = itemIndex.get(item.id) ?? 0;
              const revealIndex = filteredIndex.get(item.id) ?? 0;
              const isAppended = index >= appendStart;
              const isFilterReveal = filterVersion > 0 && revealIndex < FILTER_REVEAL_COUNT;
              const animateMount = !reduceMotion && (isAppended || isFilterReveal);
              const mountDelay = isAppended
                ? Math.min(index - appendStart, 9) * 0.032
                : revealIndex * 0.032;
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
                  {/* 动态页默认不预取；单条动态内容不可变，显式预取让点击即时打开。 */}
                  <Link className="ai-news__entry" data-content-id={item.id} href={`/ai-news/${item.id}` as Route} prefetch={true}>
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
