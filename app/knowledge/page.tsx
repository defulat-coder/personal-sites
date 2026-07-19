import type { Metadata } from "next";

import { ContentPageFrame } from "@/components/content-page-frame";
import {
  collectionContent,
  collectionStats,
  knowledgeContent,
} from "@/lib/site-content";

export const metadata: Metadata = {
  description: collectionContent.knowledge.summary,
  title: "知识索引｜陈远",
};

export default function KnowledgePage() {
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

        <section
          className="knowledge-structure"
          data-content-id={collectionContent.knowledge.id}
          aria-labelledby="knowledge-structure-title"
        >
          <div className="knowledge-structure__heading">
            <p>OKF INDEX STRUCTURE</p>
            <h2 id="knowledge-structure-title">当前知识索引的原始结构</h2>
            <span>以下数字与状态直接来自 OKF 索引，不读取或发布私有 Raw 正文。</span>
          </div>
          <dl className="knowledge-structure__list">
            {collectionContent.knowledge.details.map((detail) => (
              <div key={detail.title}>
                <dt>{detail.title}</dt>
                <dd>{detail.summary}</dd>
              </div>
            ))}
          </dl>
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
                <div className="topic-index__copy">
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  <ol
                    className="topic-index__details"
                    aria-label={`${item.title}索引明细`}
                  >
                    {item.details.map((detail, detailIndex) => (
                      <li key={detail.title}>
                        <span>{String(detailIndex + 1).padStart(2, "0")}</span>
                        <h4>{detail.title}</h4>
                        <p>{detail.summary}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </article>
            ))}
          </div>
        </section>

      </article>
    </ContentPageFrame>
  );
}
