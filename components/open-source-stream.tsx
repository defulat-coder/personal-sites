"use client";

import { ArrowUpRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

import styles from "@/components/open-source.module.css";
import {
  getOpenSourceCategoryLabel,
  getOpenSourceDimensionLabel,
  openSourceCategories,
  openSourceDimensions,
  type OpenSourceCategory,
  type OpenSourceDimension,
  type OpenSourceEntry,
} from "@/lib/open-source";

type OpenSourceStreamProps = {
  entries: OpenSourceEntry[];
};

export function OpenSourceStream({ entries }: OpenSourceStreamProps) {
  const [category, setCategory] = useState<OpenSourceCategory>("all");
  const [dimension, setDimension] = useState<OpenSourceDimension | "all">("all");
  const entriesInCategory = category === "all"
    ? entries
    : entries.filter((entry) => entry.category === category);
  const availableDimensions = openSourceDimensions.filter((item) =>
    entriesInCategory.some((entry) => entry.dimensions.includes(item.id)),
  );
  const visibleEntries = dimension === "all"
    ? entriesInCategory
    : entriesInCategory.filter((entry) => entry.dimensions.includes(dimension));

  const changeCategory = (nextCategory: OpenSourceCategory) => {
    const nextEntries = nextCategory === "all"
      ? entries
      : entries.filter((entry) => entry.category === nextCategory);

    if (dimension !== "all" && !nextEntries.some((entry) => entry.dimensions.includes(dimension))) {
      setDimension("all");
    }

    setCategory(nextCategory);
  };

  return (
    <section aria-label="已判读的开源项目" className={styles.streamSection}>
      <div className={styles.filters} role="group" aria-label="按主题筛选">
        {openSourceCategories.map((item) => (
          <button
            aria-pressed={category === item.id}
            className={styles.filter}
            key={item.id}
            onClick={() => changeCategory(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.dimensionFilters} role="group" aria-label="按智能体能力维度筛选">
        <button
          aria-pressed={dimension === "all"}
          className={styles.dimensionFilter}
          onClick={() => setDimension("all")}
          type="button"
        >
          全部能力
        </button>
        {availableDimensions.map((item) => (
          <button
            aria-pressed={dimension === item.id}
            className={styles.dimensionFilter}
            key={item.id}
            onClick={() => setDimension(item.id)}
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
                <span>{getOpenSourceDimensionLabel(entry.dimensions[0])}</span>
                <span>{entry.type}</span>
                <span>{entry.status}</span>
              </div>
              <div className={styles.copy}>
                <h2>{entry.repository}</h2>
                <p className={styles.source}>{entry.sourceSummary}</p>
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
