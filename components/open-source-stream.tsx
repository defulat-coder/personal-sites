"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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
  const visibleEntries = category === "all"
    ? entries
    : entries.filter((entry) => entry.category === category);

  return (
    <section aria-label="已判读的开源项目" className={styles.streamSection}>
      <div className={styles.filters} role="group" aria-label="按主题筛选">
        {openSourceCategories.map((item) => (
          <button
            aria-pressed={category === item.id}
            className={styles.filter}
            key={item.id}
            onClick={() => setCategory(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <ol className={styles.stream}>
        {visibleEntries.map((entry) => (
          <li key={entry.slug}>
            <Link href={`/open-source/${entry.slug}`}>
              <div className={styles.meta}>
                <span>{getOpenSourceCategoryLabel(entry.category)}</span>
                <span>{getOpenSourceDimensionLabel(entry.dimensions[0])}</span>
                <span>{entry.type}</span>
                <span>{entry.status}</span>
              </div>
              <div className={styles.copy}>
                <h2>{entry.repository}</h2>
                <p className={styles.source}>{entry.sourceSummary}</p>
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
