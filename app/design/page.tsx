import type { Metadata } from "next";
import { Suspense } from "react";

import { CurationStream } from "@/components/curation-stream";
import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import { SiteProfile } from "@/components/site-profile";
import { getDesignCurationPage } from "@/lib/curation";

export const revalidate = 300;

export const metadata: Metadata = {
  description: "陈远在 X 点赞与收藏的设计相关内容，视频可直接在站内播放。",
  title: "设计收藏｜陈远",
};

function FeedSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="curation-home__stream-skeleton">
      <span />
      <span className="is-medium" />
      <span className="is-short" />
    </div>
  );
}

async function DesignFeed() {
  const designPage = await getDesignCurationPage(0, 20);
  return (
    <CurationStream
      apiPath="/api/design"
      emptyLabel="暂时没有高置信度的设计收藏。"
      initialHasMore={designPage.hasMore}
      initialItems={designPage.items}
      snapshotKey="design-stream-v1"
      variant="design"
    />
  );
}

export default function DesignPage() {
  return (
    <main className="curation-home" id="site-main" tabIndex={-1}>
      <SiteProfile mobileSection="design" />
      <SectionMotionLifecycle section="design" />
      <section aria-label="设计收藏" className="curation-home__feed site-section-motion">
        <ContentSectionNavigation current="design" />
        <Suspense fallback={<FeedSkeleton />}>
          <DesignFeed />
        </Suspense>
      </section>
    </main>
  );
}
