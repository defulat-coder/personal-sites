import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, GitBranch, Play } from "lucide-react";

import { InteractiveDotField } from "@/components/interactive-dot-field";
import { ArticleMarkdown } from "@/components/article-markdown";
import { ProfileIntroduction } from "@/components/profile-introduction";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  curationItems,
  findCurationItem,
  formatCurationDate,
  type CurationItem,
} from "@/lib/curation";

type CurationEntryPageProps = { params: Promise<{ id: string }> };

const profileCopy = [
  "目前在 payermax，我做的不是 AI Demo，而是能进入企业研发主链路的 Agentic Engineering System：把 Claude Code、Codex、Pi 变成可编排、可观测、可评测、可追溯的生产能力。",
  "技术上横跨 React + TypeScript、Python Agent Runtime 与 Java 分布式服务：前端任务态可视化，后端工作流调度，SSE 事件流，Tool 调用与质量 / 成本度量，一条链打到位。",
  "11 年工程与架构经验，曾在喜马拉雅和红星美凯龙啃过企业智能助手、数据中台、云原生迁移与高并发业务系统；不只交付模块，更让复杂系统持续演进。",
];

const profileCopyEnglish = [
  "At PayerMax, I build more than AI demos: Agentic Engineering Systems that enter the core enterprise development workflow, turning Claude Code, Codex, and Pi into production capabilities that are orchestrated, observable, evaluated, and traceable.",
  "Across React + TypeScript, Python agent runtimes, and Java distributed services, I build the whole path: task-state visualization in the frontend, workflow orchestration in the backend, SSE event streams, tool calls, and quality/cost measurement.",
  "With 11 years in engineering and architecture, I have built enterprise assistants, data platforms, cloud-native migrations, and high-concurrency systems at Ximalaya and Red Star Macalline—not merely shipping modules, but enabling complex systems to keep evolving.",
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
    <main className="curation-home curation-detail" id="site-main" tabIndex={-1}>
      <aside aria-labelledby="profile-name" className="curation-home__profile">
        <ThemeToggle />
        <Image
          alt="参考站提供的头像插画"
          className="curation-home__avatar"
          height={105}
          priority
          src="/images/ample-avatar.png"
          width={105}
        />

        <div className="curation-home__identity">
          <h1 id="profile-name">陈远</h1>
          <p>@defulat-coder</p>
        </div>

        <nav aria-label="陈远的外部主页" className="curation-home__external-links">
          <a href="https://github.com/defulat-coder" rel="noreferrer" target="_blank">
            <GitBranch aria-hidden="true" />
            GitHub
          </a>
        </nav>

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
                ) : (
                  <a
                    className="curation-detail__media-video"
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

        <section aria-label="深度解析" className="curation-detail__section curation-detail__analysis">
          <h2 className="curation-detail__eyebrow">深度解析</h2>
          <ArticleMarkdown source={item.analysis} />
        </section>

        <footer className="curation-detail__sources" aria-label="原始链接">
          <h2 className="curation-detail__eyebrow">原始来源</h2>
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
    </main>
  );
}
