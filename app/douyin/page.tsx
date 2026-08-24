import type { Metadata } from "next";
import { Suspense } from "react";

import { CurationStream } from "@/components/curation-stream";
import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import { SiteProfile } from "@/components/site-profile";
import { getDouyinCurationPage } from "@/lib/curation";

// 与 /curation 一致：策展投影随部署打包进 data/curation.sqlite，本页读本地库；
// revalidate 只对页面外壳有意义，内容更新以重新部署为准。
export const revalidate = 300;

export const metadata: Metadata = {
  description: "陈远从抖音收藏视频中收录并写下策展解析的判断流。",
  title: "抖音收藏｜陈远",
};

// 流式骨架：与列表加载更多的骨架共用同一套样式。
function FeedSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="curation-home__stream-skeleton">
      <span />
      <span className="is-medium" />
      <span className="is-short" />
    </div>
  );
}

async function DouyinFeed() {
  const douyinPage = await getDouyinCurationPage(0, 20);
  return (
    <CurationStream
      apiPath="/api/douyin"
      emptyLabel="暂无已发布的抖音收藏条目。"
      initialHasMore={douyinPage.hasMore}
      initialItems={douyinPage.items}
      snapshotKey="douyin-stream-v1"
    />
  );
}

export default function DouyinPage() {
  // 壳（个人信息栏、版块导航）立即渲染，列表数据经 Suspense 流式补进。
  return (
    <main className="curation-home" id="site-main" tabIndex={-1}>
      <SiteProfile mobileSection="douyin" />
      <SectionMotionLifecycle section="douyin" />
      <section aria-label="抖音收藏" className="curation-home__feed site-section-motion">
        <ContentSectionNavigation current="douyin" />
        <Suspense fallback={<FeedSkeleton />}>
          <DouyinFeed />
        </Suspense>
      </section>
    </main>
  );
}
