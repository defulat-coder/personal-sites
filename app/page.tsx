import { AiNewsStream } from "@/components/ai-news-stream";
import { CurationStream } from "@/components/curation-stream";
import type { FocusView } from "@/components/focus-stream";
import { HomeMain } from "@/components/home-main";
import { OpenSourceStream } from "@/components/open-source-stream";
import type { SiteSection } from "@/components/site-section-navigation";
import { getAiNewsPage, AI_NEWS_LIST_LIMIT } from "@/lib/ai-news";
import { getCurationPage } from "@/lib/curation";
import { getOpenSourceListEntries } from "@/lib/open-source";

// 动态渲染、每请求直读 Supabase 公开投影：每日动态 5 分钟一变，不用 ISR
// 时间缓存——否则缓存过期后的首次访问仍先拿到旧页面。
export const dynamic = "force-dynamic";

type HomeSearchParams = {
  view?: string | string[];
};

function resolveHomeView(value: HomeSearchParams["view"]): {
  initialView: FocusView;
  mobileSection: SiteSection;
} {
  const view = Array.isArray(value) ? value[0] : value;
  if (view === "ai-news" || view === "daily" || view === "open-source") {
    return { initialView: view, mobileSection: view };
  }
  return { initialView: "ai-news", mobileSection: "home" };
}

async function HomeData({ initialView }: { initialView: FocusView }) {
  if (initialView === "daily") {
    const curationPage = await getCurationPage();
    return <CurationStream initialHasMore={curationPage.hasMore} initialItems={curationPage.items} />;
  }
  if (initialView === "open-source") {
    return <OpenSourceStream entries={await getOpenSourceListEntries()} />;
  }

  const aiNewsPage = await getAiNewsPage(0, AI_NEWS_LIST_LIMIT);
  return <AiNewsStream initialHasMore={aiNewsPage.hasMore} initialItems={aiNewsPage.items} />;
}

// searchParams 只决定首页壳的移动形态与遗留内容视图；数据读取继续留在壳内的
// Suspense 中，因此身份轨、刊头和它们的客户端动效在整次流式响应里只挂载一次。
export default async function HomePage({ searchParams }: { searchParams: Promise<HomeSearchParams> }) {
  const { initialView, mobileSection } = resolveHomeView((await searchParams).view);
  return (
    <HomeMain initialView={initialView} mobileSection={mobileSection}>
      <HomeData initialView={initialView} />
    </HomeMain>
  );
}
