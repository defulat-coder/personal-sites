import { CurationStream } from "@/components/curation-stream";
import { OpenSourceStream } from "@/components/open-source-stream";
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import type { CurationListItem } from "@/lib/curation-types";
import type { OpenSourceListEntry } from "@/lib/open-source-types";

export type FocusView = "daily" | "open-source";

type FocusStreamProps = {
  initialHasMore: boolean;
  initialItems: CurationListItem[];
  initialView: FocusView;
  openSourceEntries: OpenSourceListEntry[];
};

const viewLabels: Record<FocusView, string> = {
  daily: "每日关注",
  "open-source": "开源关注",
};

export function FocusStream({ initialHasMore, initialItems, initialView, openSourceEntries }: FocusStreamProps) {
  return (
    <section aria-label={viewLabels[initialView]} className="curation-home__feed site-section-motion">
      <ContentSectionNavigation current={initialView} />

      {initialView === "daily"
        ? <CurationStream initialHasMore={initialHasMore} initialItems={initialItems} />
        : <OpenSourceStream entries={openSourceEntries} />}
    </section>
  );
}
