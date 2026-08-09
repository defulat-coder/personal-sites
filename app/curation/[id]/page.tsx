import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Play } from "lucide-react";

import { KnowledgeMarkdown } from "@/components/knowledge-markdown";
import { WorkspaceFrame } from "@/components/workspace-frame";
import {
  curationItems,
  findCurationItem,
  formatCurationDate,
  type CurationItem,
} from "@/lib/curation";

type CurationEntryPageProps = { params: Promise<{ id: string }> };

/** 把原文里的 t.co 短链替换为可点击的展开后链接 */
function linkifyText(text: string, links: CurationItem["links"]) {
  const shortToExpanded = new Map(
    links
      .filter((link) => link.shortUrl)
      .map((link) => [link.shortUrl as string, link.url]),
  );
  return text.split(/(\s+)/u).map((part, index) => {
    const match = /^(https?:\/\/t\.co\/\w+)([.,;:!?）)]*)$/u.exec(part);
    if (!match) return part;
    const [, shortUrl, suffix] = match;
    return (
      <span key={index}>
        <a href={shortToExpanded.get(shortUrl) ?? shortUrl} rel="noreferrer noopener" target="_blank">
          {shortUrl}
        </a>
        {suffix}
      </span>
    );
  });
}

export function generateStaticParams() {
  return curationItems.map((item) => ({ id: item.id }));
}

export async function generateMetadata({
  params,
}: CurationEntryPageProps): Promise<Metadata> {
  const item = findCurationItem((await params).id);
  return item
    ? { description: item.summary, title: `${item.title}｜每日策展` }
    : {};
}

export default async function CurationEntryPage({
  params,
}: CurationEntryPageProps) {
  const item = findCurationItem((await params).id);
  if (!item) notFound();

  return (
    <WorkspaceFrame active="curation">
      <article className="curation-entry" data-content-id={item.id}>
        <nav aria-label="返回" className="curation-entry__back">
          <Link href="/curation">
            <ArrowLeft aria-hidden="true" />
            每日策展
          </Link>
        </nav>

        <header className="curation-entry__header">
          <div className="curation-entry__meta">
            <time dateTime={item.publishedAt ?? undefined}>
              {formatCurationDate(item)}
            </time>
            <span>来自 @{item.author.handle}（{item.author.name}）</span>
          </div>
          <h1>{item.title}</h1>
          <p>{item.summary}</p>
          <div className="curation-entry__tags">
            {item.tags.map((tag) => (
              <em key={tag}>{tag}</em>
            ))}
          </div>
        </header>

        <section aria-label="原始内容" className="curation-entry__original">
          <h2>原始内容</h2>
          <blockquote>
            <p>{linkifyText(item.text, item.links)}</p>
            <footer>
              — @{item.author.handle}（{item.author.name}）
            </footer>
          </blockquote>
          {item.quoteContext ? (
            <blockquote className="curation-entry__quote">
              <p>{linkifyText(item.quoteContext.text, item.links)}</p>
              <footer>
                — @{item.quoteContext.author}（{item.quoteContext.authorName}）的引用原文
              </footer>
            </blockquote>
          ) : null}
          {item.media.length > 0 ? (
            <div className="curation-entry__media">
              {item.media.map((media) =>
                media.type === "photo" ? (
                  <a
                    href={media.url}
                    key={media.url}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- 外部推文媒体直链 */}
                    <img
                      alt="推文配图"
                      height={media.height ?? undefined}
                      loading="lazy"
                      src={media.url}
                      width={media.width ?? undefined}
                    />
                  </a>
                ) : (
                  <a
                    className="curation-entry__media-video"
                    href={item.tweetUrl}
                    key={media.url}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- 外部推文媒体直链 */}
                    <img
                      alt="视频封面"
                      height={media.height ?? undefined}
                      loading="lazy"
                      src={media.previewUrl ?? media.url}
                      width={media.width ?? undefined}
                    />
                    <span>
                      <Play aria-hidden="true" />
                      视频内容 · 在 X 上查看
                    </span>
                  </a>
                ),
              )}
            </div>
          ) : null}
        </section>

        <section aria-label="深度解析" className="curation-entry__analysis">
          <h2 className="curation-entry__analysis-heading">深度解析</h2>
          <KnowledgeMarkdown source={item.analysis} />
        </section>

        <footer className="curation-entry__sources" aria-label="原始链接">
          <h2>原始来源</h2>
          <ul>
            <li>
              <a href={item.tweetUrl} rel="noreferrer noopener" target="_blank">
                X 原文（@{item.author.handle}）
                <ArrowUpRight aria-hidden="true" />
              </a>
            </li>
            {item.links.map((link) => (
              <li key={link.url}>
                <a href={link.url} rel="noreferrer noopener" target="_blank">
                  {link.url}
                  <ArrowUpRight aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </footer>
      </article>
    </WorkspaceFrame>
  );
}
