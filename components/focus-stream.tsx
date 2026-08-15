import { AiNewsStream } from "@/components/ai-news-stream";
import { CurationStream } from "@/components/curation-stream";
import { HomeSnapshot, type HomeSnapshotNewsItem } from "@/components/home-snapshot";
import { OpenSourceStream } from "@/components/open-source-stream";
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import type { AiNewsListItem } from "@/lib/ai-news-types";
import type { CurationListItem } from "@/lib/curation-types";
import type { OpenSourceListEntry } from "@/lib/open-source-types";

export type FocusView = "home" | "ai-news" | "daily" | "open-source";

type FocusStreamProps = {
  aiNewsHasMore: boolean;
  aiNewsItems: AiNewsListItem[];
  aiNewsSnapshotItems: HomeSnapshotNewsItem[];
  initialHasMore: boolean;
  initialItems: CurationListItem[];
  initialView: FocusView | null;
  openSourceEntries: OpenSourceListEntry[];
};

const viewLabels: Record<FocusView, string> = {
  home: "今日快照",
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

export function FocusStream({ aiNewsHasMore, aiNewsItems, aiNewsSnapshotItems, initialHasMore, initialItems, initialView, openSourceEntries }: FocusStreamProps) {
  return (
    <section aria-label={initialView ? viewLabels[initialView] : "内容"} className="curation-home__feed site-section-motion">
      <ContentSectionNavigation current={initialView ?? "home"} />

      {initialView === null ? <FeedSkeleton /> : null}
      {initialView === "home"
        ? <HomeSnapshot aiNewsItems={aiNewsSnapshotItems} curationItems={initialItems} openSourceEntries={openSourceEntries} />
        : null}
      {initialView === "ai-news" ? <AiNewsStream initialHasMore={aiNewsHasMore} initialItems={aiNewsItems} /> : null}
      {initialView === "daily"
        ? <CurationStream initialHasMore={initialHasMore} initialItems={initialItems} />
        : null}
      {initialView === "open-source" ? <OpenSourceStream entries={openSourceEntries} /> : null}
    </section>
  );
}
