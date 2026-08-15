import type { Metadata } from "next";

import { CurationStream } from "@/components/curation-stream";
import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import { SiteProfile } from "@/components/site-profile";
import { getCurationPage } from "@/lib/curation";

// 与首页读同一份 Supabase 公开投影缓存：首次访问按需生成，五分钟内复用。
export const revalidate = 300;

export const metadata: Metadata = {
  description: "陈远在 X 上点赞并逐条写下策展解析的判断流。",
  title: "推特点赞｜陈远",
};

export default async function CurationPage() {
  const curationPage = await getCurationPage();
  return (
    <main className="curation-home" id="site-main" tabIndex={-1}>
      <SiteProfile mobileSection="daily" />
      <SectionMotionLifecycle section="daily" />
      <section aria-label="推特点赞" className="curation-home__feed site-section-motion">
        <ContentSectionNavigation current="daily" />
        <CurationStream initialHasMore={curationPage.hasMore} initialItems={curationPage.items} />
      </section>
    </main>
  );
}
