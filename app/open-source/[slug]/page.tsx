import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OpenSourceDocumentTabs } from "@/components/open-source-document-tabs";
import { SiteProfile } from "@/components/site-profile";
import { ThemeToggle } from "@/components/theme-toggle";
import { getOpenSourceEntry } from "@/lib/open-source";

type OpenSourceEntryPageProps = {
  params: Promise<{ slug: string }>;
};

// 与 /curation/[id] 一致：首次访问按需生成，随后五分钟内复用页面结果。
export const revalidate = 300;

export function generateStaticParams() {
  return [];
}

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
  const { slug } = await params;
  const entry = await getOpenSourceEntry(slug);
  if (!entry) notFound();

  return (
    <main className="curation-home curation-detail curation-open-source-detail" id="site-main" tabIndex={-1}>
      <SiteProfile />

      <article className="curation-detail__article curation-open-source__article">
        <nav aria-label="返回" className="curation-detail__back">
          <Link href="/open-source">
            <ArrowLeft aria-hidden="true" />
            返回开源关注
          </Link>
          <ThemeToggle />
        </nav>

        <header className="curation-detail__header">
          <h1>{entry.repository}</h1>
        </header>

        {entry.personalNote ? (
          <section aria-label="判读" className="curation-detail__section curation-detail__note">
            <h2 className="curation-detail__eyebrow">判读</h2>
            <p>{entry.personalNote}</p>
          </section>
        ) : null}

        <OpenSourceDocumentTabs
          parsedMarkdown={entry.parsedMarkdown ?? ""}
          readingSource={entry.readingSource ?? "kimi-translation"}
          readingSourcePath={entry.readingSourcePath ?? null}
          repository={entry.repository}
          repositoryUrl={entry.repositoryUrl}
          slug={entry.slug}
          sourceUrl={entry.evidence.url}
        />

        <footer aria-label="来源" className="curation-detail__section curation-detail__source">
          <a className="curation-detail__cta" href={entry.repositoryUrl} rel="noreferrer" target="_blank">
            在 GitHub 查看仓库
            <ArrowUpRight aria-hidden="true" />
          </a>
          <span className="curation-detail__cta-host">{new URL(entry.repositoryUrl).host}</span>
        </footer>
      </article>
    </main>
  );
}
