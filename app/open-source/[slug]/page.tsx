import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import styles from "@/components/open-source.module.css";
import { OpenSourceDocumentTabs } from "@/components/open-source-document-tabs";
import { SiteProfile } from "@/components/site-profile";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  getOpenSourceCategoryLabel,
  getOpenSourceDimensionLabel,
  getOpenSourceEntry,
} from "@/lib/open-source";

type OpenSourceEntryPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: OpenSourceEntryPageProps): Promise<Metadata> {
  const entry = await getOpenSourceEntry((await params).slug);
  return entry
    ? {
      description: entry.personalNote,
      title: `${entry.repository}｜开源关注`,
    }
    : {};
}

export default async function OpenSourceEntryPage({ params }: OpenSourceEntryPageProps) {
  const entry = await getOpenSourceEntry((await params).slug);
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

        <OpenSourceDocumentTabs
          parsedMarkdown={entry.parsedMarkdown ?? ""}
          readingSource={entry.readingSource ?? "kimi-translation"}
          readingSourcePath={entry.readingSourcePath ?? null}
          sourceUrl={entry.evidence.url}
          sourceMarkdown={entry.sourceMarkdown ?? ""}
          sourceTitle={entry.sourceTitle ?? "原始 README"}
        />
      </article>
    </main>
  );
}
