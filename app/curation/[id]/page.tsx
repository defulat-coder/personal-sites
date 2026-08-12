import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Play } from "lucide-react";

import { ArticleMarkdown } from "@/components/article-markdown";
import { SiteProfile } from "@/components/site-profile";
import { ThemeToggle } from "@/components/theme-toggle";
import { XAppLink } from "@/components/x-app-link";
import { XVideoPlayer } from "@/components/x-video-player";
import {
  findCurationItem,
} from "@/lib/curation";
import { formatCurationDate, formatOriginalPublicationDate } from "@/lib/curation-format";
import type { CurationItem } from "@/lib/curation-types";

type CurationEntryPageProps = { params: Promise<{ id: string }> };

// 公开策展不依赖用户态：首次访问按需生成，随后五分钟内直接复用页面结果，
// 让列表中的链接可以被 Next 提前加载，而非必须等到用户点击后再查询 Supabase。
export const revalidate = 300;

export function generateStaticParams() {
  return [];
}

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
        <XAppLink href={shortToExpanded.get(shortUrl) ?? shortUrl}>
          {shortUrl}
        </XAppLink>
        {suffix}
      </span>
    );
  });
}

export async function generateMetadata({
  params,
}: CurationEntryPageProps): Promise<Metadata> {
  const item = await findCurationItem((await params).id);
  return item
    ? { description: item.summary, title: `${item.title}｜每日关注` }
    : {};
}

export default async function CurationEntryPage({
  params,
}: CurationEntryPageProps) {
  const item = await findCurationItem((await params).id);
  if (!item) notFound();

  return (
    <main className="curation-home curation-detail" id="site-main" tabIndex={-1}>
      <SiteProfile />

      <article className="curation-detail__article" data-content-id={item.id}>
        <nav aria-label="返回" className="curation-detail__back">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            返回每日关注
          </Link>
          <ThemeToggle />
        </nav>

        <header className="curation-detail__header">
          <div className="curation-detail__context">
            <div className="curation-detail__meta">
              <time dateTime={item.collectedAt ?? item.publishedAt ?? undefined}>
                {formatCurationDate(item)}
              </time>
              <span>来自 @{item.author.handle}（{item.author.name}）</span>
              <span>原推发布于 {formatOriginalPublicationDate(item)}</span>
            </div>
            <div className="curation-detail__tags">
              {item.tags.map((tag) => (
                <em key={tag}>{tag}</em>
              ))}
            </div>
          </div>
          <div className="curation-detail__intro">
            <h1>{item.title}</h1>
            <p>{item.summary}</p>
          </div>
        </header>

        <section aria-label="原始内容" className="curation-detail__section curation-detail__original">
          <h2 className="curation-detail__eyebrow">原始内容</h2>
          <blockquote>
            <p>{linkifyText(item.text, item.links)}</p>
            <footer>
              — @{item.author.handle}（{item.author.name}）
            </footer>
          </blockquote>
          {item.quoteContext ? (
            <blockquote className="curation-detail__quote">
              <p>{linkifyText(item.quoteContext.text, item.links)}</p>
              <footer>
                — @{item.quoteContext.author}（{item.quoteContext.authorName}）的引用原文
              </footer>
            </blockquote>
          ) : null}
          {item.media.length > 0 ? (
            <div className="curation-detail__media">
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
                ) : media.videoUrl ? (
                  <XVideoPlayer
                    isAnimatedGif={media.type === "animated_gif"}
                    key={media.url}
                    poster={media.previewUrl ?? media.url}
                    tweetUrl={item.tweetUrl}
                    videoUrl={media.videoUrl}
                  />
                ) : (
                  <XAppLink
                    className="curation-detail__media-video"
                    href={item.tweetUrl}
                    key={media.url}
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
                  </XAppLink>
                ),
              )}
            </div>
          ) : null}
        </section>

        <section aria-label="深度解析" className="curation-detail__section curation-detail__analysis">
          <h2 className="curation-detail__eyebrow">深度解析</h2>
          <ArticleMarkdown source={item.analysis} />
        </section>

        <footer className="curation-detail__sources" aria-label="原始链接">
          <h2 className="curation-detail__eyebrow">原始来源</h2>
          <ul>
            <li>
              <XAppLink href={item.tweetUrl}>
                X 原文（@{item.author.handle}）
                <ArrowUpRight aria-hidden="true" />
              </XAppLink>
            </li>
            {item.links.map((link) => (
              <li key={link.url}>
                <XAppLink href={link.url}>
                  {link.url}
                  <ArrowUpRight aria-hidden="true" />
                </XAppLink>
              </li>
            ))}
          </ul>
        </footer>
      </article>
    </main>
  );
}
