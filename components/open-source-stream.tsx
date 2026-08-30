"use client";

import { motion, useReducedMotion } from "motion/react";
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

const FILTER_REVEAL_COUNT = 8;
const FILTER_REVEAL_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function OpenSourceStream({ entries }: OpenSourceStreamProps) {
  const [category, setCategory] = useState<OpenSourceCategory>("all");
  const [hasFiltered, setHasFiltered] = useState(false);
  const reduceMotion = useReducedMotion();
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

      <ol aria-live="polite" className={styles.stream} key={category}>
        {visibleEntries.map((entry, index) => {
          const animateEntry = hasFiltered && !reduceMotion && index < FILTER_REVEAL_COUNT;
          return (
            <motion.li
              animate={{ opacity: 1, y: 0 }}
              initial={animateEntry ? { opacity: 0, y: "0.5rem" } : false}
              key={entry.slug}
              transition={{
                delay: animateEntry ? index * 0.032 : 0,
                duration: animateEntry ? 0.28 : 0,
                ease: FILTER_REVEAL_EASE,
              }}
            >
              <Link href={`/open-source/${entry.slug}`}>
                <div className={styles.meta}>
                  <span>{getOpenSourceCategoryLabel(entry.category)}</span>
                  <span>{entry.status}</span>
                </div>
                <div className={styles.copy}>
                  <h2>{entry.repository}</h2>
                  <p className={styles.source}>{entry.sourceSummary}</p>
                  <div className={styles.tags}>
                    <span>{getOpenSourceDimensionLabel(entry.dimensions[0])}</span>
                    <span>{entry.type}</span>
                  </div>
                </div>
              </Link>
            </motion.li>
          );
        })}
      </ol>
      {visibleEntries.length === 0 ? <p className={styles.empty}>暂时没有符合当前筛选的已公开仓库。</p> : null}
    </section>
  );
}
