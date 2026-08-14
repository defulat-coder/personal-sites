import Link from "next/link";
import type { CSSProperties } from "react";

import styles from "@/components/works.module.css";
import type { WorkEntry } from "@/lib/works-types";

type WorksStreamProps = {
  entries: WorkEntry[];
};

export function WorksStream({ entries }: WorksStreamProps) {
  return (
    <ol aria-label="构建列表" className={styles.stream}>
      {entries.map((entry, index) => (
        <li key={entry.slug} style={{ "--work-entry-index": index } as CSSProperties}>
          <Link href={`/works/${entry.slug}`}>
            <div className={styles.meta}>
              <span>{entry.period}</span>
              <span>{entry.status}</span>
            </div>
            <div className={styles.copy}>
              <h2>{entry.title}</h2>
              <p className={styles.summary}>{entry.summary}</p>
              <div className={styles.stack}>
                {entry.stack.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}
