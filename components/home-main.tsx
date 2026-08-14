import { FocusStream, type FocusView } from "@/components/focus-stream";
import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import type { SiteSection } from "@/components/site-section-navigation";
import { SiteProfile } from "@/components/site-profile";
import type { AiNewsListItem } from "@/lib/ai-news-types";
import type { CurationListItem } from "@/lib/curation-types";
import type { OpenSourceListEntry } from "@/lib/open-source-types";

export type HomeStreamData = {
  aiNewsHasMore: boolean;
  aiNewsItems: AiNewsListItem[];
  initialHasMore: boolean;
  initialItems: CurationListItem[];
  openSourceEntries: OpenSourceListEntry[];
};

type HomeMainProps = HomeStreamData & {
  initialView: FocusView | null;
  mobileSection: SiteSection;
};

// 首页主体结构在服务端（静态/ISR）与客户端（读取 ?view=）之间共享。
export function HomeMain({ aiNewsHasMore, aiNewsItems, initialHasMore, initialItems, initialView, mobileSection, openSourceEntries }: HomeMainProps) {
  return (
    <main className={`curation-home${mobileSection === "home" ? " curation-home--mobile-home" : ""}`} id="site-main" tabIndex={-1}>
      <SiteProfile animateOnFirstHomeVisit mobileSection={mobileSection} />
      <SectionMotionLifecycle section={mobileSection} />
      <FocusStream
        aiNewsHasMore={aiNewsHasMore}
        aiNewsItems={aiNewsItems}
        initialHasMore={initialHasMore}
        initialItems={initialItems}
        initialView={initialView}
        openSourceEntries={openSourceEntries}
      />
    </main>
  );
}
