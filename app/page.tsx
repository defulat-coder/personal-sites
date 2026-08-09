import Image from "next/image";
import { BookOpen, GitBranch } from "lucide-react";

import { CurationStream } from "@/components/curation-stream";
import { InteractiveDotField } from "@/components/interactive-dot-field";
import { ProfileIntroduction } from "@/components/profile-introduction";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurationPage } from "@/lib/curation";

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

export default async function HomePage() {
  const curationPage = await getCurationPage();
  return (
    <main className="curation-home" id="site-main" tabIndex={-1}>
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

      <section aria-labelledby="curation-feed-title" className="curation-home__feed">
        <header className="curation-home__feed-heading">
          <h2 id="curation-feed-title">每日策展</h2>
          <p>持续更新</p>
        </header>

        <CurationStream initialHasMore={curationPage.hasMore} initialItems={curationPage.items} />
      </section>
    </main>
  );
}
