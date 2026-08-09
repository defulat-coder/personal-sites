import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BookOpen, GitBranch } from "lucide-react";

import { InteractiveDotField } from "@/components/interactive-dot-field";
import { ThemeToggle } from "@/components/theme-toggle";
import { curationItems, formatCurationDate } from "@/lib/curation";
import { siteShell } from "@/lib/site-shell";

const profileCopy = [
  "我持续整理个人知识、项目与 Agent 工程实践，把零散证据沉淀为可查询、可复用的公开索引。",
  "目前围绕 Codex / Claude Code 工作流、多 Agent 协作与知识系统，验证从原型到工程化的路径。",
  "每日策展记录来自 X 上值得继续阅读、复盘和落地的技术内容。",
];

export default function HomePage() {
  return (
    <main className="curation-home" id="site-main" tabIndex={-1}>
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
          {siteShell.externalLinks.map((link) => (
            <a href={link.href} key={link.href} rel="noreferrer" target="_blank">
              {link.label === "GitHub" ? <GitBranch aria-hidden="true" /> : <BookOpen aria-hidden="true" />}
              {link.label}
            </a>
          ))}
        </nav>

        <InteractiveDotField />

        <section className="curation-home__bio" aria-labelledby="profile-introduction">
          <h2 id="profile-introduction">你好，</h2>
          {profileCopy.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>
      </aside>

      <section aria-labelledby="curation-feed-title" className="curation-home__feed">
        <header className="curation-home__feed-heading">
          <h2 id="curation-feed-title">每日策展</h2>
          <p>持续更新</p>
        </header>

        <ol className="curation-home__stream">
          {curationItems.map((item) => (
            <li key={item.id}>
              <Link data-content-id={item.id} href={`/curation/${item.id}` as Route}>
                <div className="curation-home__stream-meta">
                  <time dateTime={item.publishedAt ?? undefined}>{formatCurationDate(item)}</time>
                  <span>@{item.author.handle}</span>
                </div>
                <div className="curation-home__stream-copy">
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                </div>
                <span aria-hidden="true" className="curation-home__stream-arrow"><ArrowUpRight /></span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
