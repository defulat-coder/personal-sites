import { AiNewsStream } from "@/components/ai-news-stream";
import { CurationStream } from "@/components/curation-stream";
import { OpenSourceStream } from "@/components/open-source-stream";
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import type { AiNewsListItem } from "@/lib/ai-news-types";
import type { CurationListItem } from "@/lib/curation-types";
import type { OpenSourceListEntry } from "@/lib/open-source-types";

export type FocusView = "ai-news" | "daily" | "open-source";

type FocusStreamProps = {
  aiNewsHasMore: boolean;
  aiNewsItems: AiNewsListItem[];
  initialHasMore: boolean;
  initialItems: CurationListItem[];
  initialView: FocusView | null;
  openSourceEntries: OpenSourceListEntry[];
};

const viewLabels: Record<FocusView, string> = {
  "ai-news": "每日动态",
  daily: "推特点赞",
  "open-source": "开源关注",
};

// Suspense fallback 的中性骨架：此时还不知道 ?view= 的目标视图，不能预设任何一条流。
function FeedSkeleton() {
  return (
    <div aria-hidden="true" className="curation-home__stream-skeleton">
      <span />
      <span className="is-medium" />
      <span className="is-short" />
    </div>
  );
}

// 桌面右侧默认每日动态：/ 不再设独立的「首页」视图，移动端首页仍是展开的个人资料。
export function FocusStream({ aiNewsHasMore, aiNewsItems, initialHasMore, initialItems, initialView, openSourceEntries }: FocusStreamProps) {
  return (
    <section aria-label={initialView ? viewLabels[initialView] : "内容"} className="curation-home__feed site-section-motion">
      <ContentSectionNavigation current={initialView ?? "ai-news"} />

      {initialView === null ? <FeedSkeleton /> : null}
      {initialView === "ai-news" ? <AiNewsStream initialHasMore={aiNewsHasMore} initialItems={aiNewsItems} /> : null}
      {initialView === "daily"
        ? <CurationStream initialHasMore={initialHasMore} initialItems={initialItems} />
        : null}
      {initialView === "open-source" ? <OpenSourceStream entries={openSourceEntries} /> : null}
    </section>
  );
}
