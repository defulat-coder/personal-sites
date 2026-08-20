import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

import { ArticleMarkdown } from "@/components/article-markdown";
import styles from "@/components/works.module.css";
import { SiteProfile } from "@/components/site-profile";
import { ThemeToggle } from "@/components/theme-toggle";
import { getWork, listWorks } from "@/lib/works";
import { workRecordKindLabels } from "@/lib/works-types";
import type { WorkRecordKind } from "@/lib/works-types";

type WorkPageProps = { params: Promise<{ slug: string }> };

// 构建内容随仓库发布，与其他公开内容保持同一 ISR 节奏。
export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const entries = await listWorks();
    return entries.map((entry) => ({ slug: entry.slug }));
  } catch {
    // 构建环境缺 Supabase env（或投影暂不可读）时不让整站构建失败：
    // 返回空集，详情页回退为首个请求时按需 ISR 渲染。
    return [];
  }
}

export async function generateMetadata({ params }: WorkPageProps): Promise<Metadata> {
  const work = await getWork((await params).slug);
  return work
    ? { description: work.summary, title: `${work.title}｜构建` }
    : {};
}

const sectionOrder: WorkRecordKind[] = ["capability", "experiment", "decision", "practice", "milestone"];

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("zh-CN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
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
              {work.sourceObservedAt ? <span>资料截至 {formatDate(work.sourceObservedAt)}</span> : null}
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

        <nav aria-label="项目档案索引" className={styles.detailIndex}>
          <a href="#project-focus">正在验证</a>
          {sectionOrder.filter((kind) => work.records?.some((record) => record.kind === kind)).map((kind) => (
            <a href={`#${kind}`} key={kind}>{workRecordKindLabels[kind]}</a>
          ))}
          {work.body ? <a href="#project-story">项目脉络</a> : null}
        </nav>

        <section className={`curation-detail__section ${styles.focusSection}`} id="project-focus">
          <h2 className="curation-detail__eyebrow">正在验证</h2>
          <p>{work.currentFocus}</p>
        </section>

        {sectionOrder.map((kind) => {
          const records = work.records?.filter((record) => record.kind === kind) ?? [];
          if (records.length === 0) return null;
          return (
            <section className="curation-detail__section" id={kind} key={kind}>
              <h2 className="curation-detail__eyebrow">{workRecordKindLabels[kind]}</h2>
              <ol className={styles.detailRecords}>
                {records.map((record) => (
                  <li id={record.id} key={record.id}>
                    <div className={styles.recordMeta}>
                      <span>{formatDate(record.occurredAt) ?? "持续记录"}</span>
                      <span>{record.status}</span>
                    </div>
                    <div className={styles.recordCopy}>
                      <h3>{record.title}</h3>
                      <p>{record.summary}</p>
                      {record.bodyMarkdown ? <ArticleMarkdown source={record.bodyMarkdown} /> : null}
                      <div aria-label="证据" className={styles.recordEvidence}>
                        {record.evidence.map((evidence) => evidence.url ? (
                          <a href={evidence.url} key={evidence.id} rel="noreferrer" target="_blank">
                            {evidence.label}
                            <ArrowUpRight aria-hidden="true" />
                          </a>
                        ) : <span key={evidence.id}>{evidence.label}</span>)}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}

        {work.body ? (
          <section aria-label="项目脉络" className="curation-detail__section" id="project-story">
            <h2 className="curation-detail__eyebrow">项目脉络</h2>
            <ArticleMarkdown source={work.body} />
          </section>
        ) : null}

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
