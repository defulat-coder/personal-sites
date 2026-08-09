"use client";

import { ArrowUpRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

import styles from "@/components/open-source.module.css";
import {
  getOpenSourceCategoryLabel,
  openSourceCategories,
  type OpenSourceCategory,
  type OpenSourceEntry,
} from "@/lib/open-source";

type OpenSourceStreamProps = {
  entries: OpenSourceEntry[];
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
            <Link href={`/open-source/${entry.slug}` as Route}>
              <div className={styles.meta}>
                <span>{getOpenSourceCategoryLabel(entry.category)}</span>
                <span>{entry.type}</span>
                <span>{entry.status}</span>
              </div>
              <div className={styles.copy}>
                <h2>{entry.repository}</h2>
                <p className={styles.source}>{entry.repositoryDescription}</p>
                <p className={styles.note}>{entry.personalNote}</p>
              </div>
              <span aria-hidden="true" className={styles.arrow}><ArrowUpRight /></span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
