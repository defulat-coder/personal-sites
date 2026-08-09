import { FocusStream, type FocusView } from "@/components/focus-stream";
import { SiteProfile } from "@/components/site-profile";
import { getCurationPage } from "@/lib/curation";

type HomePageProps = {
  searchParams: Promise<{ view?: string | string[] }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const view = (await searchParams).view;
  const initialView: FocusView = view === "open-source" ? "open-source" : "daily";
  const curationPage = await getCurationPage();
  return (
    <main className="curation-home" id="site-main" tabIndex={-1}>
      <SiteProfile animateOnFirstHomeVisit />
      <FocusStream
        initialHasMore={curationPage.hasMore}
        initialItems={curationPage.items}
        initialView={initialView}
      />
    </main>
  );
}
