import { Suspense } from "react";

import { HomeMain, type HomeStreamData } from "@/components/home-main";
import { HomeView } from "@/components/home-view";
import { getCurationPage } from "@/lib/curation";
import { getOpenSourceListEntries } from "@/lib/open-source";

export const revalidate = 300;

export default async function HomePage() {
  const [curationPage, openSourceEntries] = await Promise.all([getCurationPage(), getOpenSourceListEntries()]);
  const streamData: HomeStreamData = {
    initialHasMore: curationPage.hasMore,
    initialItems: curationPage.items,
    openSourceEntries,
  };
  return (
    <Suspense fallback={<HomeMain {...streamData} initialView="daily" mobileSection="home" />}>
      <HomeView {...streamData} />
    </Suspense>
  );
}
