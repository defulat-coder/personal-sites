import type { Metadata } from "next";

// 方向契约（案头卷宗 · 2026-08-16 impeccable 掷签 3d2abe48 锁定，2026-08-20 扩展）：
// THESIS: 构建页是运行中的项目档案——项目是根上下文，能力、实验、决策和实践只在所属卷宗内展开；拒绝全局实验池和卡片目录。
// OWN-WORLD: 沿用全站单色黑白灰 + 1px 细线 + 留白；截图是唯一媒体主角，12px 媒体圆角 + 细线描边，无卡片无阴影。
// STORY: 访客先看见项目正在做什么，再沿最近记录进入项目档案，理解能力如何由实验、决策和证据形成。
// FIRST VIEWPORT: 刊头之下是主件题名、定位、真实样张与三条最近项目记录；无样张项目退为带当前关注与记录摘要的登记行。
// FORM: 案头卷宗（候选排序第 6，掷签 dealt 7/1/6 中由用户按推荐锁定）。
// FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import { SiteProfile } from "@/components/site-profile";
import { WorksStream } from "@/components/works-stream";
import { listWorks } from "@/lib/works";

export const metadata: Metadata = {
  description: "陈远的构建档案：按项目整理当前能力、实验、决策、实践与可追溯证据。",
  title: "构建｜陈远",
};

export const revalidate = 300;

export default async function WorksPage() {
  const entries = await listWorks();
  return (
    <main className="curation-home" id="site-main" tabIndex={-1}>
      <SiteProfile mobileSection="works" />
      <SectionMotionLifecycle section="works" />
      <section aria-label="构建" className="curation-home__feed site-section-motion">
        <ContentSectionNavigation current="works" />
        <WorksStream entries={entries} />
      </section>
    </main>
  );
}
