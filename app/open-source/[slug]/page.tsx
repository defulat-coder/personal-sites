import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/open-source.module.css";
import { SiteProfile } from "@/components/site-profile";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  getOpenSourceCategoryLabel,
  getOpenSourceEntry,
  openSourceEntries,
} from "@/lib/open-source";

type OpenSourceEntryPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return openSourceEntries.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: OpenSourceEntryPageProps): Promise<Metadata> {
  const entry = getOpenSourceEntry((await params).slug);
  return entry
    ? {
      description: entry.personalNote,
      title: `${entry.repository}｜开源关注`,
    }
    : {};
}

export default async function OpenSourceEntryPage({ params }: OpenSourceEntryPageProps) {
  const entry = getOpenSourceEntry((await params).slug);
  if (!entry) notFound();

  return (
    <main className="curation-home curation-detail curation-open-source-detail" id="site-main" tabIndex={-1}>
      <SiteProfile />

      <article className="curation-detail__article curation-open-source__article">
        <nav aria-label="返回" className="curation-detail__back">
          <Link href={"/open-source" as Route}>
            <ArrowLeft aria-hidden="true" />
            返回开源关注
          </Link>
          <ThemeToggle />
        </nav>

        <header className={`curation-detail__header ${styles.entryHeader}`}>
          <div className="curation-detail__meta">
            <span>{getOpenSourceCategoryLabel(entry.category)}</span>
            <span>{entry.type}</span>
            <span>{entry.status}</span>
          </div>
          <h1>{entry.repository}</h1>
          <p>GitHub 收藏 · 非本人项目</p>
        </header>

        <section aria-label="仓库原貌" className={`curation-detail__section ${styles.section}`}>
          <h2 className="curation-detail__eyebrow">仓库原貌</h2>
          <p className={styles.bodyCopy}>{entry.repositoryDescription}</p>
          <a
            className={styles.repositoryLink}
            href={entry.repositoryUrl}
            rel="noreferrer"
            target="_blank"
          >
            在 GitHub 查看原始仓库
            <ArrowUpRight aria-hidden="true" />
          </a>
        </section>

        <section aria-label="为什么进入我的雷达" className={`curation-detail__section ${styles.section}`}>
          <h2 className="curation-detail__eyebrow">为什么进入我的雷达</h2>
          <p className={styles.bodyCopy}>{entry.personalNote}</p>
        </section>

        <section aria-label="我关注的机制" className={`curation-detail__section ${styles.section}`}>
          <h2 className="curation-detail__eyebrow">我关注的机制</h2>
          <ul className={styles.focusList}>
            {entry.focus.map((focus) => <li key={focus}>{focus}</li>)}
          </ul>
        </section>

        <section aria-label="当前判断" className={`curation-detail__section ${styles.section}`}>
          <h2 className="curation-detail__eyebrow">当前判断</h2>
          <p className={styles.bodyCopy}>{entry.judgement}</p>
        </section>

        <footer aria-label="下一步" className={`curation-detail__sources ${styles.nextStep}`}>
          <h2 className="curation-detail__eyebrow">下一步</h2>
          <p>{entry.nextStep}</p>
        </footer>
      </article>
    </main>
  );
}
