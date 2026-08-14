import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
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
          <Link href="/?view=open-source">
            <ArrowLeft aria-hidden="true" />
            返回开源关注
          </Link>
          <ThemeToggle />
        </nav>

        <header className="curation-detail__header">
          <h1>{entry.repository}</h1>
        </header>

        <OpenSourceDocumentTabs
          parsedMarkdown={entry.parsedMarkdown ?? ""}
          readingSource={entry.readingSource ?? "kimi-translation"}
          readingSourcePath={entry.readingSourcePath ?? null}
          repository={entry.repository}
          repositoryUrl={entry.repositoryUrl}
          slug={entry.slug}
          sourceUrl={entry.evidence.url}
        />
      </article>
    </main>
  );
}
