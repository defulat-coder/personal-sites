import type { Metadata } from "next";
import Image from "next/image";

import { ContentPageFrame } from "@/components/content-page-frame";
import {
  collectionContent,
  identityContent,
} from "@/lib/site-content";

const streams = [
  {
    item: collectionContent.projects,
    label: "项目",
  },
  {
    item: collectionContent.knowledge,
    label: "知识",
  },
  {
    item: collectionContent.practice,
    label: "实践",
  },
] as const;

export const metadata: Metadata = {
  description: identityContent.summary,
  title: "关于我｜陈远",
};

export default function AboutPage() {
  return (
    <ContentPageFrame active="about">
      <article className="content-page" data-page-route="about">
        <header className="about-page__hero">
          <div className="content-page__hero-title">
            <p>ABOUT / PUBLIC PROFILE</p>
            <h1>关于我</h1>
          </div>
          <div className="about-page__portrait">
            <Image
              alt="陈远的公开头像插画"
              fill
              priority
              sizes="619px"
              src="/images/avatar-source.png"
            />
          </div>
        </header>

        <section
          className="about-page__intro"
          data-content-id={identityContent.id}
        >
          <p>HELLO, I AM</p>
          <div>
            <h2>{identityContent.title}</h2>
            <p>{identityContent.summary}</p>
          </div>
        </section>

        <section className="about-streams" aria-labelledby="about-streams-title">
          <div className="content-page__section-heading">
            <p>THREE THREADS</p>
            <h2 id="about-streams-title">公开页面里的三条主线</h2>
            <span>项目说明做过什么，知识说明如何思考，实践说明怎样持续迭代。</span>
          </div>
          <div className="about-streams__list">
            {streams.map(({ item, label }, index) => (
              <article data-content-id={item.id} key={item.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <small>{label}</small>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </article>
    </ContentPageFrame>
  );
}
