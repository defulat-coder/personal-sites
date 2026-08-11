import { FocusStream, type FocusView } from "@/components/focus-stream";
import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import type { SiteSection } from "@/components/site-section-navigation";
import { SiteProfile } from "@/components/site-profile";
import { getCurationPage } from "@/lib/curation";
import { getOpenSourceListEntries } from "@/lib/open-source";

type HomePageProps = {
  searchParams: Promise<{ view?: string | string[] }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const view = (await searchParams).view;
  const mobileView: SiteSection = view === "open-source" ? "open-source" : view === "daily" ? "daily" : "home";
  const initialView: FocusView = mobileView === "open-source" ? "open-source" : "daily";
  const [curationPage, openSourceEntries] = await Promise.all([getCurationPage(), getOpenSourceListEntries()]);
  return (
    <main className={`curation-home${mobileView === "home" ? " curation-home--mobile-home" : ""}`} id="site-main" tabIndex={-1}>
      <SiteProfile animateOnFirstHomeVisit mobileSection={mobileView} />
      <SectionMotionLifecycle section={mobileView} />
      <FocusStream
        initialHasMore={curationPage.hasMore}
        initialItems={curationPage.items}
        initialView={initialView}
        openSourceEntries={openSourceEntries}
      />
    </main>
  );
}
