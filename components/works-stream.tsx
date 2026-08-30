import Link from "next/link";

import styles from "@/components/works.module.css";
import { WorksShotStrip } from "@/components/works-shot-strip";
import { workRecordKindLabels } from "@/lib/works-types";
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

function RecentRecords({ entry }: { entry: WorkEntry }) {
  const records = [...(entry.records ?? [])]
    .sort((left, right) => (right.occurredAt ?? right.updatedAt).localeCompare(left.occurredAt ?? left.updatedAt))
    .slice(0, 3);
  if (!entry.currentFocus && records.length === 0) return null;
  return (
    <div className={styles.recordPreview}>
      {entry.currentFocus ? (
        <p className={styles.focus}>
          <span>当前关注</span>
          {entry.currentFocus}
        </p>
      ) : null}
      {records.length > 0 ? (
        <ol aria-label={`${entry.title} 最近项目记录`}>
          {records.map((record) => (
            <li key={record.id}>
              <span>{workRecordKindLabels[record.kind]}</span>
              <strong>{record.title}</strong>
              <small>{record.status}</small>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function DossierEntry({ entry }: { entry: WorkEntry }) {
  return (
    <li className={styles.dossier}>
      <header className={styles.dossierHead}>
        <div className={styles.dossierIntro}>
          <h2>
            <Link href={`/works/${entry.slug}`}>{entry.title}</Link>
          </h2>
          <p className={styles.summary}>{entry.summary}</p>
        </div>
      </header>

      <WorksShotStrip shots={entry.shots} workTitle={entry.title} />

      <RecentRecords entry={entry} />

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

function RegistryEntry({ entry }: { entry: WorkEntry }) {
  return (
    <li>
      <Link className={styles.row} href={`/works/${entry.slug}`}>
        <WorkMeta entry={entry} />
        <div className={styles.copy}>
          <h2>{entry.title}</h2>
          <p className={styles.summary}>{entry.summary}</p>
          <RecentRecords entry={entry} />
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
  if (entries.length === 0) {
    return <p className={styles.empty}>项目档案正在整理，公开修订完成后会出现在这里。</p>;
  }
  return (
    <ol aria-label="我的作品列表" className={styles.stream}>
      {entries.map((entry) =>
        entry.shots.length > 0 ? (
          <DossierEntry entry={entry} key={entry.slug} />
        ) : (
          <RegistryEntry entry={entry} key={entry.slug} />
        ),
      )}
    </ol>
  );
}
