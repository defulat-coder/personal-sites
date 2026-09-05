"use client";

/*
 * 每日关注 · 剪报簿（方向契约，种子 8999beeb）
 * THESIS: 每条目把判断（题名+解析）与证据（原推剪报摘录+附件登记+标签）贴在同一行登记簿里，拒绝"链接列表"式信息流。
 * OWN-WORLD: 沿用全站单色黑白灰与 1px 细线登记栏；剪报只用 1px 左引线与降调灰阶区分"原文声音"，不新增颜色、容器或阴影。
 * STORY: 访客在列表里同时读到他赞了什么与他怎么判断；进详情后原推以样张贴片完整呈现，读完解析顺势翻向相邻剪报。
 * FIRST VIEWPORT: 刊头下第一行即是完整样张——左列登记（收录日期/作者/附件），右列判断标题、解析、剪报摘录、标签行。
 * FORM: 剪报样张（dealt #3；dealt #6 作者回廊、#5 月度合订因削弱判断流主角而落选；auto 模式下代用户锁定）。
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
 */

import { useStreamDate } from "@/components/use-stream-date";
import { motion, useReducedMotion } from "motion/react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { formatCurationClip, formatCurationDate } from "@/lib/curation-format";
import type { CurationListItem } from "@/lib/curation-types";
import { XVideoPlayer } from "@/components/x-video-player";

import { observeCurationScrollEnd, getCurationScrollTarget } from "./curation-scroll";
import {
  readCurationStreamSnapshot,
  toCurationStreamSnapshot,
  writeCurationStreamSnapshot,
} from "./curation-stream-snapshot";

type CurationPageResponse = {
  error?: string;
  hasMore: boolean;
  items: CurationListItem[];
};

type CurationStreamProps = {
  /** 加载更多的分页接口；每日关注用 /api/curation，抖音收藏用 /api/douyin。 */
  apiPath?: string;
  /** 空列表时的提示文案。 */
  emptyLabel?: string;
  initialHasMore: boolean;
  initialItems: CurationListItem[];
  /** 会话快照的 sessionStorage key；两个板块各自独立，互不覆盖。 */
  snapshotKey?: string;
  /** 设计收藏在列表内直接呈现可播放视频，详情入口缩为标题链接以避免嵌套交互。 */
  variant?: "default" | "design";
};

const PAGE_SIZE = 20;

export function CurationStream({ apiPath = "/api/curation", emptyLabel = "暂无已发布的策展条目。", initialHasMore, initialItems, snapshotKey, variant = "default" }: CurationStreamProps) {
  const streamRef = useRef<HTMLOListElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [items, setItems] = useState(initialItems);
  const visibleDay = useStreamDate(wrapperRef, items);
  const currentDate = visibleDay ?? (items[0] ? formatCurationDate(items[0]) : null);
  const [appendStart, setAppendStart] = useState(initialItems.length);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 会话快照恢复：从详情页返回时把分页与滚动位置还原，避免列表从头开始。
  // restored 是一次性开关——恢复后的重渲染提交完成、DOM 行数齐全后再落滚动位置。
  const [restored, setRestored] = useState(false);
  const scrollTopRef = useRef(0);
  const restoreScrollTopRef = useRef(0);
  // 快照写入门闩：挂载提交期间（含 StrictMode 重放、dev 下的重挂载）禁止写快照——
  // 否则恢复读取之前，初始 SSR 状态会先把有效快照覆盖掉。挂载落定后由宏任务开门。
  const writesEnabledRef = useRef(false);
  const latestRef = useRef({ hasMore, items });

  // 仅挂载时执行：首渲染仍用 SSR 数据（无水合不一致），layout effect 里的
  // setState 会在绘制前同步重渲染，访客看不到从 20 条跳回完整列表的过程。
  useLayoutEffect(() => {
    const enableWrites = window.setTimeout(() => {
      writesEnabledRef.current = true;
    }, 0);
    if (!restored) {
      const snapshot = readCurationStreamSnapshot(initialItems[0]?.id, snapshotKey);
      if (snapshot) {
        restoreScrollTopRef.current = snapshot.scrollTop;
        scrollTopRef.current = snapshot.scrollTop;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- 恢复 sessionStorage 快照只能在挂载后做，layout effect 保证绘制前完成
        setItems(snapshot.items);
        setHasMore(snapshot.hasMore);
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

  // 分页变化时持久化快照；滚动位置在写入时从 ref 取最新值。
  useEffect(() => {
    latestRef.current = { hasMore, items };
    if (!writesEnabledRef.current || items.length === 0) return;
    writeCurationStreamSnapshot(toCurationStreamSnapshot({
      hasMore,
      items,
      scrollTop: scrollTopRef.current,
    }), snapshotKey);
  }, [hasMore, items, snapshotKey]);

  // 路由离开（点进详情）时组件卸载，兜底写一次最终状态。
  useEffect(() => () => {
    if (!writesEnabledRef.current) return;
    const latest = latestRef.current;
    if (latest.items.length === 0) return;
    writeCurationStreamSnapshot(toCurationStreamSnapshot({ ...latest, scrollTop: scrollTopRef.current }), snapshotKey);
  }, [snapshotKey]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setLoadError(null);
    setAppendStart(items.length);
    try {
      const response = await fetch(`${apiPath}?offset=${items.length}&limit=${PAGE_SIZE}`);
      const payload = (await response.json()) as CurationPageResponse;
      if (!response.ok) throw new Error(payload.error ?? "暂时无法加载更多策展内容。");

      setItems((currentItems) => {
        const knownIds = new Set(currentItems.map((item) => item.id));
        return [...currentItems, ...payload.items.filter((item) => !knownIds.has(item.id))];
      });
      setHasMore(payload.hasMore);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "暂时无法加载更多策展内容。");
    } finally {
      setIsLoading(false);
    }
  }, [apiPath, hasMore, isLoading, items.length]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!hasMore || !stream) return;

    return observeCurationScrollEnd(stream, () => void loadMore());
  }, [hasMore, loadMore]);

  return (
    <div ref={wrapperRef}>
      {currentDate ? <div className="stream-date-toolbar">
        <span className="curation-stream__date">{currentDate}</span>
      </div> : null}
    <ol className="curation-home__stream" ref={streamRef}>
      {items.map((item, index) => {
        const isAppended = index >= appendStart;
        const playableMedia = item.media.filter((media) => media.videoUrl);
        // 首屏条目随 SSR 静态输出；只有无限滚动追加的条目播放入场阶梯动画。
        return (
        <motion.li
          animate={isAppended ? { opacity: 1, y: 0 } : undefined}
          initial={isAppended && !reduceMotion ? { opacity: 0, y: "0.45rem" } : false}
          data-stream-date={formatCurationDate(item)}
          key={item.id}
          transition={{
            delay: isAppended ? Math.min(index - appendStart, 9) * 0.032 : 0,
            duration: 0.3,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {variant === "design" ? (
            <article className="design-curation__entry">
              <div className="curation-home__stream-meta">
                <time dateTime={item.collectedAt ?? item.publishedAt ?? undefined}>{formatCurationDate(item)}</time>
                <span>{`X · @${item.author.handle}`}</span>
                {item.design?.categories.length ? <span>{item.design.categories.join(" · ")}</span> : null}
              </div>
              <div className="curation-home__stream-copy">
                <h3>
                  <Link data-content-id={item.id} href={`/design/${item.id}` as Route}>{item.title}</Link>
                </h3>
                <p>{item.summary}</p>
                {playableMedia.length > 0 ? (
                  <div className="design-curation__media">
                    {playableMedia.map((media) => (
                      <XVideoPlayer
                        compact
                        isAnimatedGif={media.type === "animated_gif"}
                        itemTitle={item.title}
                        key={media.videoUrl}
                        poster={media.previewUrl ?? media.url}
                        tweetUrl={item.source.url}
                        videoUrl={media.videoUrl!}
                      />
                    ))}
                  </div>
                ) : null}
                {item.text.trim() ? (
                  <blockquote className="curation-home__stream-clip">
                    <p>{formatCurationClip(item.text)}</p>
                  </blockquote>
                ) : null}
                {item.tags.length > 0 ? <p className="curation-home__stream-tags">{item.tags.join(" · ")}</p> : null}
              </div>
            </article>
          ) : (
          <Link data-content-id={item.id} href={`/curation/${item.id}` as Route}>
            <div className="curation-home__stream-meta">
              <time dateTime={item.collectedAt ?? item.publishedAt ?? undefined}>{formatCurationDate(item)}</time>
              <span>{item.source.platform === "x" ? `X · @${item.author.handle}` : `抖音 · ${item.author.name}`}</span>
              {item.attachments.length > 0 ? <span>{item.attachments.join(" · ")}</span> : null}
            </div>
            <div className="curation-home__stream-copy">
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              {item.text.trim() ? (
                <blockquote className="curation-home__stream-clip">
                  <p>{formatCurationClip(item.text)}</p>
                </blockquote>
              ) : null}
              {item.tags.length > 0 ? (
                <p className="curation-home__stream-tags">{item.tags.join(" · ")}</p>
              ) : null}
            </div>
          </Link>
          )}
        </motion.li>
        );
      })}
      <li aria-live="polite" className="curation-home__stream-status">
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
        {!hasMore && !loadError ? <span>{items.length === 0 ? emptyLabel : "已加载全部策展内容"}</span> : null}
      </li>
    </ol>
    </div>
  );
}
