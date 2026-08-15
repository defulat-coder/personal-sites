import Link from "next/link";
import type { CSSProperties } from "react";

import styles from "@/components/works.module.css";
import { WorksShotStrip } from "@/components/works-shot-strip";
import type { WorkEntry } from "@/lib/works-types";

type WorksStreamProps = {
  entries: WorkEntry[];
};

function WorkMeta({ entry }: { entry: WorkEntry }) {
  return (
    <div className={styles.meta}>
      <span>{entry.period}</span>
      <span>{entry.status}</span>
      <span>{entry.role}</span>
    </div>
  );
}

function DossierEntry({ entry, index }: { entry: WorkEntry; index: number }) {
  return (
    <li className={styles.dossier} style={{ "--work-entry-index": index } as CSSProperties}>
      <header className={styles.dossierHead}>
        <div className={styles.dossierIntro}>
          <h2>
            <Link href={`/works/${entry.slug}`}>{entry.title}</Link>
          </h2>
          <p className={styles.summary}>{entry.summary}</p>
        </div>
      </header>

      <WorksShotStrip shots={entry.shots} workTitle={entry.title} />

      <footer className={styles.dossierFoot}>
        <div className={styles.dossierFootMeta}>
          <div className={styles.meta}>
            <span>{entry.period}</span>
            <span>{entry.status}</span>
            <span>{entry.role}</span>
          </div>
          <div className={styles.stack}>
            {entry.stack.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
        <div className={styles.links}>
          <Link href={`/works/${entry.slug}`}>构建笔记</Link>
          {entry.url ? (
            <a href={entry.url} rel="noreferrer" target="_blank">
              在线访问
            </a>
          ) : null}
          {entry.repo ? (
            <a href={entry.repo} rel="noreferrer" target="_blank">
              GitHub
            </a>
          ) : null}
        </div>
      </footer>
    </li>
  );
}

function RegistryEntry({ entry, index }: { entry: WorkEntry; index: number }) {
  return (
    <li style={{ "--work-entry-index": index } as CSSProperties}>
      <Link className={styles.row} href={`/works/${entry.slug}`}>
        <WorkMeta entry={entry} />
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
  );
}

export function WorksStream({ entries }: WorksStreamProps) {
  return (
    <ol aria-label="我的作品列表" className={styles.stream}>
      {entries.map((entry, index) =>
        entry.shots.length > 0 ? (
          <DossierEntry entry={entry} index={index} key={entry.slug} />
        ) : (
          <RegistryEntry entry={entry} index={index} key={entry.slug} />
        ),
      )}
    </ol>
  );
}
