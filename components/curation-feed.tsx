"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { formatCurationDate } from "@/lib/curation-format";
import type { CurationItem } from "@/lib/curation-types";

type CurationFeedProps = {
  items: CurationItem[];
  tags: string[];
};

export function CurationFeed({ items, tags }: CurationFeedProps) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const visible = activeTag
    ? items.filter((item) => item.tags.includes(activeTag))
    : items;

  return (
    <>
      <div className="curation-feed__filters" role="group" aria-label="按标签筛选">
        <button
          aria-pressed={activeTag === null}
          className="curation-tag"
          data-active={activeTag === null || undefined}
          onClick={() => setActiveTag(null)}
          type="button"
        >
          全部
        </button>
        {tags.map((tag) => (
          <button
            aria-pressed={activeTag === tag}
            className="curation-tag"
            data-active={activeTag === tag || undefined}
            key={tag}
            onClick={() => setActiveTag(tag === activeTag ? null : tag)}
            type="button"
          >
            {tag}
          </button>
        ))}
      </div>

      <ol className="curation-feed__list">
        {visible.map((item) => (
          <li key={item.id}>
            <Link
              className="curation-card"
              data-content-id={item.id}
              href={`/curation/${item.id}` as Route}
            >
              <div className="curation-card__meta">
                <time dateTime={item.publishedAt ?? undefined}>
                  {formatCurationDate(item)}
                </time>
                <span>@{item.author.handle}</span>
              </div>
              <strong>{item.title}</strong>
              <p>{item.summary}</p>
              <div className="curation-card__footer">
                <span className="curation-card__tags">
                  {item.tags.map((tag) => (
                    <em key={tag}>{tag}</em>
                  ))}
                </span>
                <ArrowUpRight aria-hidden="true" />
              </div>
            </Link>
          </li>
        ))}
      </ol>
      {visible.length === 0 ? (
        <p className="curation-feed__empty">这个标签下暂时没有策展内容。</p>
      ) : null}
    </>
  );
}
