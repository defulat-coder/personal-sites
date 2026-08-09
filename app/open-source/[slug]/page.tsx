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
  getOpenSourceDimensionLabel,
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
            <span>GitHub 收藏 · 非本人项目</span>
          </div>
          <h1>{entry.repository}</h1>
          <p>{entry.sourceSummary}</p>
          <div aria-label="智能体能力维度" className="curation-detail__tags">
            {entry.dimensions.map((dimension) => (
              <em key={dimension}>{getOpenSourceDimensionLabel(dimension)}</em>
            ))}
          </div>
        </header>

        <section aria-label="仓库事实" className={`curation-detail__section ${styles.section}`}>
          <h2 className="curation-detail__eyebrow">仓库事实</h2>
          <p className={styles.bodyCopy}>{entry.evidence.note}</p>
          <a
            className={styles.repositoryLink}
            href={entry.evidence.url}
            rel="noreferrer"
            target="_blank"
          >
            解析依据 · {entry.evidence.label}
            <ArrowUpRight aria-hidden="true" />
          </a>
          <a
            className={styles.repositoryLink}
            href={entry.repositoryUrl}
            rel="noreferrer"
            target="_blank"
          >
            在 GitHub 查看仓库
            <ArrowUpRight aria-hidden="true" />
          </a>
        </section>

        <section aria-label="工作方式" className={`curation-detail__section ${styles.section}`}>
          <h2 className="curation-detail__eyebrow">工作方式</h2>
          <ol className={styles.workflow}>
            {entry.workflow.map((step, index) => (
              <li key={step.label}>
                <span aria-hidden="true">0{index + 1}</span>
                <div>
                  <h3>{step.label}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="适用场景" className={`curation-detail__section ${styles.section}`}>
          <h2 className="curation-detail__eyebrow">适用场景</h2>
          <ul className={styles.detailList}>
            {entry.scenarios.map((scenario) => <li key={scenario}>{scenario}</li>)}
          </ul>
        </section>

        <section aria-label="边界与注意" className={`curation-detail__section ${styles.section}`}>
          <h2 className="curation-detail__eyebrow">边界与注意</h2>
          <ul className={styles.detailList}>
            {entry.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}
          </ul>
        </section>

        <section aria-label="我的研判" className={`curation-detail__section ${styles.section}`}>
          <h2 className="curation-detail__eyebrow">我的研判</h2>
          <p className={styles.bodyCopy}>{entry.personalNote}</p>
          <p className={styles.judgement}>{entry.judgement}</p>
        </section>

        <footer aria-label="下一步" className={`curation-detail__sources ${styles.nextStep}`}>
          <h2 className="curation-detail__eyebrow">后续关注</h2>
          <p>{entry.nextStep}</p>
        </footer>
      </article>
    </main>
  );
}
