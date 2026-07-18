import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ContentPageFrame } from "@/components/content-page-frame";
import {
  collectionContent,
  collectionStats,
  practiceContent,
} from "@/lib/site-content";

export const metadata: Metadata = {
  description: collectionContent.practice.summary,
  title: "实践索引｜陈远",
};

export default function PracticePage() {
  return (
    <ContentPageFrame active="practice">
      <article className="content-page" data-page-route="practice">
        <header
          className="content-page__hero"
          data-content-id={collectionContent.practice.id}
        >
          <div className="content-page__hero-title">
            <p>PRACTICE / AGENT HISTORY</p>
            <h1>实践索引</h1>
          </div>
          <div className="content-page__hero-copy">
            <strong>{collectionContent.practice.title}</strong>
            <p>{collectionContent.practice.summary}</p>
          </div>
        </header>

        <section className="index-stats" aria-label="实践索引概览">
          {collectionStats.practice.map((stat) => (
            <div key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </section>

        <section aria-labelledby="practice-projects-title">
          <div className="content-page__section-heading">
            <p>ACTIVE TRAJECTORIES</p>
            <h2 id="practice-projects-title">会话密度最高的工程现场</h2>
            <span>不是能力清单，而是项目索引留下的真实迭代轨迹。</span>
          </div>
          <div className="practice-index">
            {practiceContent.map((item, index) => (
              <article
                className="practice-index__entry"
                data-content-id={item.id}
                key={item.id}
              >
                <div className="practice-index__image">
                  <Image
                    alt=""
                    fill
                    sizes="320px"
                    src={item.image}
                  />
                </div>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <nav className="content-page__next" aria-label="继续浏览">
          <span>NEXT PAGE</span>
          <Link href="/about">
            了解陈远 <ArrowRight aria-hidden="true" />
          </Link>
        </nav>
      </article>
    </ContentPageFrame>
  );
}
