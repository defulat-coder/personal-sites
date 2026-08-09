import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpen, GitBranch, Play } from "lucide-react";

import { InteractiveDotField } from "@/components/interactive-dot-field";
import { ArticleMarkdown } from "@/components/article-markdown";
import { ProfileIntroduction } from "@/components/profile-introduction";
import { ThemeToggle } from "@/components/theme-toggle";
import { XAppLink } from "@/components/x-app-link";
import { XVideoPlayer } from "@/components/x-video-player";
import {
  findCurationItem,
} from "@/lib/curation";
import { formatCurationDate } from "@/lib/curation-format";
import type { CurationItem } from "@/lib/curation-types";

type CurationEntryPageProps = { params: Promise<{ id: string }> };

const profileCopy = [
  "十余年项目开发经验，横跨 Java、Python、TypeScript 与前端；从业务平台、云服务到企业 AI，一直在做需要长期负责的工程系统。",
  "现在关心 AI 如何进入真实工作，Web 如何成为新的创造界面，以及系统如何经得起长期使用。",
  "这里记录正在构建的东西，以及那些值得继续拆解的工程问题。",
];

const profileCopyEnglish = [
  "With more than a decade in project development across Java, Python, TypeScript, and frontend work, I have built engineering systems meant to be owned for the long term—from business platforms and cloud services to enterprise AI.",
  "I care about how AI enters real work, how the web becomes a new creative interface, and how systems remain useful over time.",
  "This is where I document what I am building and the engineering problems worth continuing to unpack.",
];

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
    ? { description: item.summary, title: `${item.title}｜每日策展` }
    : {};
}

export default async function CurationEntryPage({
  params,
}: CurationEntryPageProps) {
  const item = await findCurationItem((await params).id);
  if (!item) notFound();

  return (
    <main className="curation-home curation-detail" id="site-main" tabIndex={-1}>
      <aside aria-labelledby="profile-name" className="curation-home__profile">
        <ThemeToggle />
        <div className="curation-home__profile-header">
          <Image
            alt="参考站提供的头像插画"
            className="curation-home__avatar"
            height={105}
            priority
            src="/images/ample-avatar.png"
            width={105}
          />

          <div className="curation-home__profile-summary">
            <div className="curation-home__identity">
              <h1 id="profile-name">陈远</h1>
              <p>@defulat-coder</p>
            </div>

            <nav aria-label="陈远的外部主页" className="curation-home__external-links">
              <a href="https://github.com/defulat-coder" rel="noreferrer" target="_blank">
                <GitBranch aria-hidden="true" />
                GitHub
              </a>
              <a href="https://www.yuque.com/defulat-coder" rel="noreferrer" target="_blank">
                <BookOpen aria-hidden="true" />
                语雀
              </a>
            </nav>
          </div>
        </div>

        <InteractiveDotField />

        <ProfileIntroduction englishParagraphs={profileCopyEnglish} paragraphs={profileCopy} />
      </aside>

      <article className="curation-detail__article" data-content-id={item.id}>
        <nav aria-label="返回" className="curation-detail__back">
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            返回每日策展
          </Link>
        </nav>

        <header className="curation-detail__header">
          <div className="curation-detail__meta">
            <time dateTime={item.publishedAt ?? undefined}>
              {formatCurationDate(item)}
            </time>
            <span>来自 @{item.author.handle}（{item.author.name}）</span>
          </div>
          <h1>{item.title}</h1>
          <p>{item.summary}</p>
          <div className="curation-detail__tags">
            {item.tags.map((tag) => (
              <em key={tag}>{tag}</em>
            ))}
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
