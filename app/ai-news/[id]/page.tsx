import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

import { SiteProfile } from "@/components/site-profile";
import { ThemeToggle } from "@/components/theme-toggle";
import { getAiNewsItem } from "@/lib/ai-news";
import {
  formatAiNewsRelativeTime,
  formatAiNewsTime,
  getAiNewsCategoryLabel,
  getAiNewsOriginalAction,
  getAiNewsUrlHost,
} from "@/lib/ai-news-types";

type AiNewsDetailPageProps = { params: Promise<{ id: string }> };

// 与首页读同一份 Supabase 公开投影缓存：首次访问按需生成，五分钟内复用。
export const revalidate = 300;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: AiNewsDetailPageProps): Promise<Metadata> {
  const item = await getAiNewsItem((await params).id);
  return item
    ? { description: item.summary || item.title, title: `${item.title}｜每日动态` }
    : {};
}

export default async function AiNewsDetailPage({ params }: AiNewsDetailPageProps) {
  const item = await getAiNewsItem((await params).id);
  if (!item) notFound();

  const relativeTime = formatAiNewsRelativeTime(item.publishedAt);

  return (
    <main className="curation-home curation-detail" id="site-main" tabIndex={-1}>
      <SiteProfile />

      <article className="ai-news-detail__article" data-content-id={item.id}>
        <nav aria-label="返回" className="ai-news-detail__topbar">
          <Link className="ai-news-detail__back" href="/ai-news">
            <ArrowLeft aria-hidden="true" />
            返回每日动态
          </Link>
          <ThemeToggle />
        </nav>

        <header className="ai-news-detail__header">
          <p className="ai-news-detail__kicker">
            {getAiNewsCategoryLabel(item.category)}
            {item.selected ? " · 精选" : ""}
          </p>
          <h1>{item.title}</h1>
          <div className="ai-news-detail__meta">
            <span>{item.sourceName}</span>
            <time dateTime={item.publishedAt ?? undefined}>{formatAiNewsTime(item.publishedAt)}</time>
            {relativeTime ? <span>{relativeTime}</span> : null}
          </div>
        </header>

        {item.summary ? (
          <section aria-label="导读" className="ai-news-detail__section ai-news-detail__lead">
            <h2 className="ai-news-detail__eyebrow">导读</h2>
            <p>{item.summary}</p>
          </section>
        ) : null}

        {item.reason ? (
          <section aria-label="推荐理由" className="ai-news-detail__section ai-news-detail__reason">
            <h2 className="ai-news-detail__eyebrow">推荐理由</h2>
            <p>{item.reason}</p>
          </section>
        ) : null}

        <footer className="ai-news-detail__source">
          <a className="ai-news-detail__cta" href={item.url} rel="noreferrer" target="_blank">
            {getAiNewsOriginalAction(item.url)}
            <ArrowUpRight aria-hidden="true" />
          </a>
          <span className="ai-news-detail__cta-host">{getAiNewsUrlHost(item.url)}</span>
        </footer>
      </article>
    </main>
  );
}
