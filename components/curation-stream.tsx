"use client";

import { ArrowUpRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { formatCurationDate } from "@/lib/curation-format";
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
        return (
        <li
          data-appended={isAppended ? "" : undefined}
          key={item.id}
          style={isAppended ? { "--stream-i": Math.min(index - appendStart, 9) } as CSSProperties : undefined}
        >
          <Link data-content-id={item.id} href={`/curation/${item.id}` as Route}>
            <div className="curation-home__stream-copy">
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <div className="curation-home__stream-meta">
                <time dateTime={item.collectedAt ?? item.publishedAt ?? undefined}>{formatCurationDate(item)}</time>
                <span>@{item.author.handle}</span>
              </div>
            </div>
            <span aria-hidden="true" className="curation-home__stream-arrow"><ArrowUpRight /></span>
          </Link>
        </li>
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
