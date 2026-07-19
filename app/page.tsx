import Image from "next/image";

import { EditorialRow } from "@/components/editorial-row";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  collectionContent,
  identityContent,
  knowledgeContent,
  practiceContent,
  projectContent,
  publicSiteContent,
} from "@/lib/site-content";
import { siteFoundation } from "@/lib/site-foundation";
import { siteShell } from "@/lib/site-shell";

export default function HomePage() {
  return (
    <>
      <a className="skip-link" href="#site-main">
        跳到主要内容
      </a>
      <div
        className="site-frame"
        data-shell-version={siteShell.version}
        data-site-shell
        id="top"
      >
        <SiteHeader />
        <main
          data-foundation-version={siteFoundation.version}
          data-public-content-hash={publicSiteContent.contentHash}
          data-site-foundation
          data-site-main
          id="site-main"
          tabIndex={-1}
        >
          <article>
            <header className="hero" data-hero>
              <div className="hero__copy">
                <h1>
                  Agent 工程
                  <br />
                  <strong>持续实践</strong>
                </h1>
                <p data-content-id={identityContent.id}>
                  with {identityContent.title} · OKF Index
                </p>
              </div>
              <div className="hero__media">
                <Image
                  alt="陈远的公开头像插画"
                  fill
                  priority
                  sizes="619px"
                  src="/images/hero-portrait.png"
                />
              </div>
            </header>

            <section className="positioning" aria-labelledby="positioning-title">
              <h2 id="positioning-title">
                <span>项目持续演进，</span>
                <span>知识不断沉淀，</span>
                <span>实践留下轨迹。</span>
              </h2>
              <div className="positioning__copy">
                {Object.values(collectionContent).map((item) => (
                  <p data-content-id={item.id} key={item.id}>
                    <strong>{item.title}</strong>
                    {item.summary}
                  </p>
                ))}
              </div>
            </section>

            <section id="projects" aria-labelledby="projects-title">
              <h2 className="section-heading" id="projects-title">
                <span>从索引里长出来的</span>
                <strong>真实项目</strong>
              </h2>
              <div className="editorial-list">
                {projectContent.map((item) => (
                  <EditorialRow item={item} key={item.id} />
                ))}
              </div>
            </section>

            <section id="knowledge" aria-labelledby="knowledge-title">
              <h2 className="section-heading" id="knowledge-title">
                <span>长期积累的</span>
                <strong>知识主题</strong>
              </h2>
              <div
                className="knowledge-overview"
                data-content-id={collectionContent.knowledge.id}
              >
                <span>OKF / YUQUE INDEX</span>
                <p>
                  <strong>{collectionContent.knowledge.title}</strong>
                  {collectionContent.knowledge.summary}
                </p>
              </div>
              <div className="knowledge-grid">
                {knowledgeContent.map((item, index) => (
                  <article
                    className="knowledge-item"
                    data-content-id={item.id}
                    key={item.id}
                  >
                    <span className="knowledge-item__index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                  </article>
                ))}
              </div>
            </section>

            <section id="practice" aria-labelledby="practice-title">
              <h2
                className="section-heading section-heading--compact"
                id="practice-title"
              >
                <span>被项目索引记录的</span>
                <strong>Agent 实践</strong>
              </h2>
              <div className="practice-grid">
                {practiceContent.map((item) => (
                  <article
                    className="practice-card"
                    data-content-id={item.id}
                    key={item.id}
                  >
                    <span className="practice-card__image">
                      <Image
                        alt=""
                        fill
                        sizes="394px"
                        src={item.image}
                      />
                    </span>
                    <span className="practice-card__copy">
                      <strong>{item.title}</strong>
                      <span>{item.summary}</span>
                    </span>
                  </article>
                ))}
              </div>
            </section>

            <section className="principle" aria-labelledby="principle-title">
              <h2 id="principle-title">
                <span>把知识沉淀成索引，</span>
                <span>再把索引带回工程。</span>
              </h2>
            </section>

            <section className="public-cta" aria-labelledby="public-cta-title">
              <p className="public-cta__eyebrow">PUBLIC INDEX</p>
              <h2 id="public-cta-title">公开索引，直接在站内阅读。</h2>
              <p data-content-id={identityContent.id}>{identityContent.summary}</p>
              <p className="public-cta__note">
                {publicSiteContent.items.length} 条公开 OKF 内容在项目、知识与实践页完整展开。
              </p>
            </section>

            <section className="about" id="about" aria-labelledby="about-title">
              <div className="about__media">
                <Image
                  alt="陈远的公开头像插画"
                  fill
                  sizes="590px"
                  src="/images/avatar-source.png"
                />
              </div>
              <div className="about__copy" data-content-id={identityContent.id}>
                <h2 id="about-title">你好，我是{identityContent.title}</h2>
                <p>{identityContent.summary}</p>
                <p>{collectionContent.projects.summary}</p>
                <p>{collectionContent.practice.summary}</p>
              </div>
            </section>
          </article>
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
