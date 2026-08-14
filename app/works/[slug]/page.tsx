import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

import { ArticleMarkdown } from "@/components/article-markdown";
import { SiteProfile } from "@/components/site-profile";
import { ThemeToggle } from "@/components/theme-toggle";
import { getWork, listWorks } from "@/lib/works";

type WorkPageProps = { params: Promise<{ slug: string }> };

// 构建内容随仓库发布，与其他公开内容保持同一 ISR 节奏。
export const revalidate = 300;

export async function generateStaticParams() {
  const entries = await listWorks();
  return entries.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: WorkPageProps): Promise<Metadata> {
  const work = await getWork((await params).slug);
  return work
    ? { description: work.summary, title: `${work.title}｜构建` }
    : {};
}

export default async function WorkPage({ params }: WorkPageProps) {
  const work = await getWork((await params).slug);
  if (!work) notFound();

  return (
    <main className="curation-home curation-detail" id="site-main" tabIndex={-1}>
      <SiteProfile />

      <article className="curation-detail__article">
        <nav aria-label="返回" className="curation-detail__back">
          <Link href="/works">
            <ArrowLeft aria-hidden="true" />
            返回构建
          </Link>
          <ThemeToggle />
        </nav>

        <header className="curation-detail__header">
          <div className="curation-detail__context">
            <div className="curation-detail__meta">
              <span>{work.period}</span>
              <span>{work.status}</span>
              <span>{work.role}</span>
            </div>
            <div className="curation-detail__tags">
              {work.stack.map((item) => (
                <em key={item}>{item}</em>
              ))}
            </div>
          </div>
          <div className="curation-detail__intro">
            <h1>{work.title}</h1>
            <p>{work.summary}</p>
          </div>
        </header>

        <section aria-label="构建笔记" className="curation-detail__section">
          <h2 className="curation-detail__eyebrow">构建笔记</h2>
          <ArticleMarkdown source={work.body} />
        </section>

        {work.repo || work.url ? (
          <footer aria-label="相关链接" className="curation-detail__sources">
            <h2 className="curation-detail__eyebrow">相关链接</h2>
            <ul>
              {work.repo ? (
                <li>
                  <a href={work.repo} rel="noreferrer" target="_blank">
                    源代码
                    <ArrowUpRight aria-hidden="true" />
                  </a>
                </li>
              ) : null}
              {work.url ? (
                <li>
                  <a href={work.url} rel="noreferrer" target="_blank">
                    在线访问
                    <ArrowUpRight aria-hidden="true" />
                  </a>
                </li>
              ) : null}
            </ul>
          </footer>
        ) : null}
      </article>
    </main>
  );
}
