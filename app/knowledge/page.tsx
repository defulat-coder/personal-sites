import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

import { ContentPageFrame } from "@/components/content-page-frame";
import {
  collectionContent,
  collectionStats,
  knowledgeContent,
} from "@/lib/site-content";
import { siteShell } from "@/lib/site-shell";

export const metadata: Metadata = {
  description: collectionContent.knowledge.summary,
  title: "知识索引｜陈远",
};

export default function KnowledgePage() {
  const yuque = siteShell.externalLinks[1];

  return (
    <ContentPageFrame active="knowledge">
      <article className="content-page" data-page-route="knowledge">
        <header
          className="content-page__hero"
          data-content-id={collectionContent.knowledge.id}
        >
          <div className="content-page__hero-title">
            <p>KNOWLEDGE / YUQUE INDEX</p>
            <h1>知识索引</h1>
          </div>
          <div className="content-page__hero-copy">
            <strong>{collectionContent.knowledge.title}</strong>
            <p>{collectionContent.knowledge.summary}</p>
            <a href={yuque.href} rel="noreferrer" target="_blank">
              <BookOpen aria-hidden="true" /> 打开个人知识库
            </a>
          </div>
        </header>

        <section className="index-stats" aria-label="知识索引概览">
          {collectionStats.knowledge.map((stat) => (
            <div key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </section>

        <section aria-labelledby="knowledge-topics-title">
          <div className="content-page__section-heading">
            <p>SUBJECT MAP</p>
            <h2 id="knowledge-topics-title">持续整理的知识主题</h2>
            <span>围绕技术、产品、工具与学习四个方向，形成可持续回看的主题目录。</span>
          </div>
          <div className="topic-index">
            {knowledgeContent.map((item, index) => (
              <article
                className="topic-index__row"
                data-content-id={item.id}
                key={item.id}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                </div>
                <a href={yuque.href} rel="noreferrer" target="_blank">
                  查看语雀 <ArrowRight aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
        </section>

        <nav className="content-page__next" aria-label="继续浏览">
          <span>NEXT INDEX</span>
          <Link href="/practice">
            查看 Agent 实践 <ArrowRight aria-hidden="true" />
          </Link>
        </nav>
      </article>
    </ContentPageFrame>
  );
}
