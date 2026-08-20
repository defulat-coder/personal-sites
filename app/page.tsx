import { Suspense } from "react";

import { HomeMain, type HomeStreamData } from "@/components/home-main";
import { HomeView } from "@/components/home-view";
import { getAiNewsPage, AI_NEWS_LIST_LIMIT } from "@/lib/ai-news";
import { getCurationPage } from "@/lib/curation";
import { getOpenSourceListEntries } from "@/lib/open-source";

// 动态渲染、每请求直读 Supabase 公开投影：每日动态 5 分钟一变，不用 ISR
// 时间缓存——否则缓存过期后的首次访问仍先拿到旧页面。
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [aiNewsPage, curationPage, openSourceEntries] = await Promise.all([
    getAiNewsPage(0, AI_NEWS_LIST_LIMIT),
    getCurationPage(),
    getOpenSourceListEntries(),
  ]);
  const streamData: HomeStreamData = {
    aiNewsHasMore: aiNewsPage.hasMore,
    aiNewsItems: aiNewsPage.items,
    initialHasMore: curationPage.hasMore,
    initialItems: curationPage.items,
    openSourceEntries,
  };
  return (
    <Suspense fallback={<HomeMain {...streamData} initialView={null} mobileSection="home" />}>
      <HomeView {...streamData} />
    </Suspense>
  );
}
