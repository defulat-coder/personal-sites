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
  initialView: FocusView;
  openSourceEntries: OpenSourceListEntry[];
};

const viewLabels: Record<FocusView, string> = {
  "ai-news": "每日动态",
  daily: "每日关注",
  "open-source": "开源关注",
};

export function FocusStream({ aiNewsHasMore, aiNewsItems, initialHasMore, initialItems, initialView, openSourceEntries }: FocusStreamProps) {
  return (
    <section aria-label={viewLabels[initialView]} className="curation-home__feed site-section-motion">
      <ContentSectionNavigation current={initialView} />

      {initialView === "ai-news" ? <AiNewsStream initialHasMore={aiNewsHasMore} initialItems={aiNewsItems} /> : null}
      {initialView === "daily"
        ? <CurationStream initialHasMore={initialHasMore} initialItems={initialItems} />
        : null}
      {initialView === "open-source" ? <OpenSourceStream entries={openSourceEntries} /> : null}
    </section>
  );
}
