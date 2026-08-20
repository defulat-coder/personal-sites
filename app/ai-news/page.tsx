import type { Metadata } from "next";

import { AiNewsStream } from "@/components/ai-news-stream";
import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import { SiteProfile } from "@/components/site-profile";
import { getAiNewsPage, AI_NEWS_LIST_LIMIT } from "@/lib/ai-news";

// 动态渲染、每请求直读 Supabase 公开投影，打开即最新。
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description: "陈远每日跟踪的 AI 与 Agent 工程动态，按日分组的连续阅读流。",
  title: "每日动态｜陈远",
};

export default async function AiNewsPage() {
  const aiNewsPage = await getAiNewsPage(0, AI_NEWS_LIST_LIMIT);
  return (
    <main className="curation-home" id="site-main" tabIndex={-1}>
      <SiteProfile mobileSection="ai-news" />
      <SectionMotionLifecycle section="ai-news" />
      <section aria-label="每日动态" className="curation-home__feed site-section-motion">
        <ContentSectionNavigation current="ai-news" />
        <AiNewsStream initialHasMore={aiNewsPage.hasMore} initialItems={aiNewsPage.items} />
      </section>
    </main>
  );
}
