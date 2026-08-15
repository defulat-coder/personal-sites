"use client";

/*
 * 推特点赞 · 剪报簿（方向契约，种子 8999beeb）
 * THESIS: 每条目把判断（题名+解析）与证据（原推剪报摘录+附件登记+标签）贴在同一行登记簿里，拒绝"链接列表"式信息流。
 * OWN-WORLD: 沿用全站单色黑白灰与 1px 细线登记栏；剪报只用 1px 左引线与降调灰阶区分"原文声音"，不新增颜色、容器或阴影。
 * STORY: 访客在列表里同时读到他赞了什么与他怎么判断；进详情后原推以样张贴片完整呈现，读完解析顺势翻向相邻剪报。
 * FIRST VIEWPORT: 刊头下第一行即是完整样张——左列登记（收录日期/作者/附件），右列判断标题、解析、剪报摘录、标签行。
 * FORM: 剪报样张（dealt #3；dealt #6 作者回廊、#5 月度合订因削弱判断流主角而落选；auto 模式下代用户锁定）。
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
 */

import { motion, useReducedMotion } from "motion/react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { formatCurationClip, formatCurationDate } from "@/lib/curation-format";
import type { CurationListItem } from "@/lib/curation-types";

import { observeCurationScrollEnd } from "./curation-scroll";

type CurationPageResponse = {
  error?: string;
  hasMore: boolean;
  items: CurationListItem[];
};

type CurationStreamProps = {
  active?: boolean;
  initialHasMore: boolean;
  initialItems: CurationListItem[];
};

const PAGE_SIZE = 20;

export function CurationStream({ active = true, initialHasMore, initialItems }: CurationStreamProps) {
  const streamRef = useRef<HTMLOListElement>(null);
  const reduceMotion = useReducedMotion();
  const [items, setItems] = useState(initialItems);
  const [appendStart, setAppendStart] = useState(initialItems.length);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadMore = useCallback(async () => {
    if (!active || isLoading || !hasMore) return;

    setIsLoading(true);
    setLoadError(null);
    setAppendStart(items.length);
    try {
      const response = await fetch(`/api/curation?offset=${items.length}&limit=${PAGE_SIZE}`);
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
  }, [active, hasMore, isLoading, items.length]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!active || !hasMore || !stream) return;

    return observeCurationScrollEnd(stream, () => void loadMore());
  }, [active, hasMore, loadMore]);

  return (
    <ol className="curation-home__stream" ref={streamRef}>
      {items.map((item, index) => {
        const isAppended = index >= appendStart;
        // 首屏条目随 SSR 静态输出；只有无限滚动追加的条目播放入场阶梯动画。
        return (
        <motion.li
          animate={{ opacity: 1, y: 0 }}
          initial={isAppended && !reduceMotion ? { opacity: 0, y: "0.45rem" } : false}
          key={item.id}
          transition={{
            delay: isAppended ? Math.min(index - appendStart, 9) * 0.032 : 0,
            duration: 0.3,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <Link data-content-id={item.id} href={`/curation/${item.id}` as Route}>
            <div className="curation-home__stream-meta">
              <time dateTime={item.collectedAt ?? item.publishedAt ?? undefined}>{formatCurationDate(item)}</time>
              <span>@{item.author.handle}</span>
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
        {!hasMore && !loadError ? <span>已加载全部策展内容</span> : null}
      </li>
    </ol>
  );
}
