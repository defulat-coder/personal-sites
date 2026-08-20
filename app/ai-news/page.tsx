import type { Metadata } from "next";
import { Suspense } from "react";

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

// 流式骨架：与列表加载更多的骨架共用同一套样式。
function FeedSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="curation-home__stream-skeleton">
      <span />
      <span className="is-medium" />
      <span className="is-short" />
    </div>
  );
}

async function AiNewsFeed() {
  const aiNewsPage = await getAiNewsPage(0, AI_NEWS_LIST_LIMIT);
  return <AiNewsStream initialHasMore={aiNewsPage.hasMore} initialItems={aiNewsPage.items} />;
}

export default function AiNewsPage() {
  // 壳（个人信息栏、版块导航）立即渲染，动态数据经 Suspense 流式补进。
  return (
    <main className="curation-home" id="site-main" tabIndex={-1}>
      <SiteProfile mobileSection="ai-news" />
      <SectionMotionLifecycle section="ai-news" />
      <section aria-label="每日动态" className="curation-home__feed site-section-motion">
        <ContentSectionNavigation current="ai-news" />
        <Suspense fallback={<FeedSkeleton />}>
          <AiNewsFeed />
        </Suspense>
      </section>
    </main>
  );
}
