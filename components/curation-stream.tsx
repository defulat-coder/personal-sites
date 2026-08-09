"use client";

import { ArrowUpRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { formatCurationDate } from "@/lib/curation-format";
import type { CurationListItem } from "@/lib/curation-types";

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
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadMore = useCallback(async () => {
    if (!active || isLoading || !hasMore) return;

    setIsLoading(true);
    setLoadError(null);
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
    if (!active || !hasMore) return;

    const loadWhenNearBottom = () => {
      const distanceToBottom = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      if (distanceToBottom <= 48) void loadMore();
    };

    window.addEventListener("scroll", loadWhenNearBottom, { passive: true });
    return () => window.removeEventListener("scroll", loadWhenNearBottom);
  }, [active, hasMore, loadMore]);

  return (
    <ol className="curation-home__stream">
      {items.map((item) => (
        <li key={item.id}>
          <Link data-content-id={item.id} href={`/curation/${item.id}` as Route}>
            <div className="curation-home__stream-meta">
              <time dateTime={item.publishedAt ?? undefined}>{formatCurationDate(item)}</time>
              <span>@{item.author.handle}</span>
            </div>
            <div className="curation-home__stream-copy">
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
            </div>
            <span aria-hidden="true" className="curation-home__stream-arrow"><ArrowUpRight /></span>
          </Link>
        </li>
      ))}
      <li aria-live="polite" className="curation-home__stream-status">
        {isLoading ? <span>正在加载更多内容</span> : null}
        {loadError ? <button onClick={() => void loadMore()} type="button">{loadError}，重试</button> : null}
        {!hasMore && !loadError ? <span>已加载全部策展内容</span> : null}
      </li>
    </ol>
  );
}
