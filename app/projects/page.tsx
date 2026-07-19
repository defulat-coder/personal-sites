import type { Metadata } from "next";

import { ContentPageFrame } from "@/components/content-page-frame";
import { EditorialRow } from "@/components/editorial-row";
import {
  collectionContent,
  collectionStats,
  projectContent,
} from "@/lib/site-content";

export const metadata: Metadata = {
  description: collectionContent.projects.summary,
  title: "项目索引｜陈远",
};

export default function ProjectsPage() {
  return (
    <ContentPageFrame active="projects">
      <article className="content-page" data-page-route="projects">
        <header
          className="content-page__hero"
          data-content-id={collectionContent.projects.id}
        >
          <div className="content-page__hero-title">
            <p>PROJECTS / OKF INDEX</p>
            <h1>项目索引</h1>
          </div>
          <div className="content-page__hero-copy">
            <strong>{collectionContent.projects.title}</strong>
            <p>{collectionContent.projects.summary}</p>
          </div>
        </header>

        <section className="index-stats" aria-label="项目索引概览">
          {collectionStats.projects.map((stat) => (
            <div key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </section>

        <section aria-labelledby="featured-projects-title">
          <div className="content-page__section-heading">
            <p>SELECTED WORK</p>
            <h2 id="featured-projects-title">正在持续演进的项目</h2>
            <span>覆盖企业 Agent、健康管理、DDD 业务建模与框架知识整理。</span>
          </div>
          <div className="editorial-list">
            {projectContent.map((item) => (
              <EditorialRow item={item} key={item.id} />
            ))}
          </div>
        </section>

      </article>
    </ContentPageFrame>
  );
}
