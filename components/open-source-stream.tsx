"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState, type CSSProperties } from "react";

import styles from "@/components/open-source.module.css";
import {
  getOpenSourceCategoryLabel,
  getOpenSourceDimensionLabel,
  openSourceCategories,
  type OpenSourceCategory,
  type OpenSourceListEntry,
} from "@/lib/open-source-types";

type OpenSourceStreamProps = {
  entries: OpenSourceListEntry[];
};

export function OpenSourceStream({ entries }: OpenSourceStreamProps) {
  const [category, setCategory] = useState<OpenSourceCategory>("all");
  const [hasFiltered, setHasFiltered] = useState(false);
  const categoryCounts = new Map<OpenSourceCategory, number>(
    openSourceCategories.map((item) => [item.id, item.id === "all" ? entries.length : 0]),
  );

  for (const entry of entries) {
    categoryCounts.set(entry.category, (categoryCounts.get(entry.category) ?? 0) + 1);
  }

  const visibleEntries = category === "all"
    ? entries
    : entries.filter((entry) => entry.category === category);

  return (
    <section aria-label="已判读的开源项目" className={styles.streamSection}>
      <div className={styles.filters} role="group" aria-label="按主题筛选">
        {openSourceCategories.map((item) => (
          <button
            aria-pressed={category === item.id}
            aria-label={`${item.label}，${categoryCounts.get(item.id) ?? 0} 个项目`}
            className={styles.filter}
            key={item.id}
            onClick={() => {
              if (item.id === category) return;
              setHasFiltered(true);
              setCategory(item.id);
            }}
            type="button"
          >
            <span>{item.label}</span>
            <span className={styles.filterCount} aria-hidden="true">
              {categoryCounts.get(item.id) ?? 0}
            </span>
          </button>
        ))}
      </div>

      <ol
        aria-live="polite"
        className={styles.stream}
        data-filtered={hasFiltered ? "true" : undefined}
        key={category}
      >
        {visibleEntries.map((entry, index) => (
          <li key={entry.slug} style={{ "--filter-entry-index": index } as CSSProperties}>
            <Link href={`/open-source/${entry.slug}`}>
              <div className={styles.copy}>
                <h2>{entry.repository}</h2>
                <p className={styles.source}>{entry.sourceSummary}</p>
                <div className={styles.meta}>
                  <span>{getOpenSourceCategoryLabel(entry.category)}</span>
                  <span>{getOpenSourceDimensionLabel(entry.dimensions[0])}</span>
                  <span>{entry.type}</span>
                  <span>{entry.status}</span>
                </div>
              </div>
              <span aria-hidden="true" className={styles.arrow}><ArrowUpRight /></span>
            </Link>
          </li>
        ))}
      </ol>
      {visibleEntries.length === 0 ? <p className={styles.empty}>暂时没有符合当前筛选的已公开仓库。</p> : null}
    </section>
  );
}
