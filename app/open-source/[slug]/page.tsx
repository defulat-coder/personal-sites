import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OpenSourceDocumentTabs } from "@/components/open-source-document-tabs";
import { SiteProfile } from "@/components/site-profile";
import { ThemeToggle } from "@/components/theme-toggle";
import { getOpenSourceEntry } from "@/lib/open-source";

type OpenSourceEntryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
};

export async function generateMetadata({ params }: OpenSourceEntryPageProps): Promise<Metadata> {
  const entry = await getOpenSourceEntry((await params).slug);
  return entry
    ? {
      description: entry.personalNote,
      title: `${entry.repository}｜开源关注`,
    }
    : {};
}

export default async function OpenSourceEntryPage({ params, searchParams }: OpenSourceEntryPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const entry = await getOpenSourceEntry(slug);
  if (!entry) notFound();
  const documentView = query.view === "repository" ? "repository" : "parsed";

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
          view={documentView}
        />
      </article>
    </main>
  );
}
