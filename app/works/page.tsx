import type { Metadata } from "next";

// 方向契约（案头卷宗 · 2026-08-16 impeccable 掷签 3d2abe48 锁定）：
// THESIS: 作品页是勘验台而非登记流——在役主件摊开：题名定位居上，多页面真实截图横排成样张带，登记栏与出口居下；无样张的作品退为紧凑登记行。
// OWN-WORLD: 沿用全站单色黑白灰 + 1px 细线 + 留白；截图是唯一媒体主角，12px 媒体圆角 + 细线描边，无卡片无阴影。
// STORY: 访客第一屏即看到作品在真实运转的界面，顺着构建笔记或 GitHub 出口继续。
// FIRST VIEWPORT: 刊头之下直接是主件题名（1.4rem/610）与一句话定位，下方样张带横向延展（每日动态/推特点赞/开源关注/问一问），底部是时间·状态·角色登记与技术栈、出口。
// FORM: 案头卷宗（候选排序第 6，掷签 dealt 7/1/6 中由用户按推荐锁定）。
// FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import { SiteProfile } from "@/components/site-profile";
import { WorksStream } from "@/components/works-stream";
import { listWorks } from "@/lib/works";

export const metadata: Metadata = {
  description: "陈远的作品：本站自身与后续项目，附真实页面样张与完整的构建笔记。",
  title: "我的作品｜陈远",
};

export default async function WorksPage() {
  const entries = await listWorks();
  return (
    <main className="curation-home" id="site-main" tabIndex={-1}>
      <SiteProfile mobileSection="works" />
      <SectionMotionLifecycle section="works" />
      <section aria-label="我的作品" className="curation-home__feed site-section-motion">
        <ContentSectionNavigation current="works" />
        <WorksStream entries={entries} />
      </section>
    </main>
  );
}
