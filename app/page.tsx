import { Suspense } from "react";

import { HomeMain, type HomeStreamData } from "@/components/home-main";
import { HomeView } from "@/components/home-view";
import { getAiNewsPage, AI_NEWS_LIST_LIMIT } from "@/lib/ai-news";
import { getCurationPage } from "@/lib/curation";
import { getOpenSourceListEntries } from "@/lib/open-source";

export const revalidate = 300;

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
