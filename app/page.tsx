import { CurationStream } from "@/components/curation-stream";
import { HomeOpenSourceLink } from "@/components/home-open-source-link";
import { SiteProfile } from "@/components/site-profile";
import { getCurationPage } from "@/lib/curation";

export default async function HomePage() {
  const curationPage = await getCurationPage();
  return (
    <main className="curation-home" id="site-main" tabIndex={-1}>
      <SiteProfile animateOnFirstHomeVisit />

      <section aria-labelledby="curation-feed-title" className="curation-home__feed">
        <header className="curation-home__feed-heading">
          <h2 id="curation-feed-title">每日关注</h2>
          <HomeOpenSourceLink />
        </header>

        <CurationStream initialHasMore={curationPage.hasMore} initialItems={curationPage.items} />
      </section>
    </main>
  );
}
