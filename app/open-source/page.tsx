import type { Metadata } from "next";

import { OpenSourceStream } from "@/components/open-source-stream";
import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import { SiteProfile } from "@/components/site-profile";
import { getOpenSourceListEntries } from "@/lib/open-source";

// 与首页读同一份 Supabase 公开投影缓存：首次访问按需生成，五分钟内复用。
export const revalidate = 300;

export const metadata: Metadata = {
  description: "陈远持续关注并写下中文判读的开源项目。",
  title: "开源关注｜陈远",
};

export default async function OpenSourcePage() {
  const openSourceEntries = await getOpenSourceListEntries();
  return (
    <main className="curation-home" id="site-main" tabIndex={-1}>
      <SiteProfile mobileSection="open-source" />
      <SectionMotionLifecycle section="open-source" />
      <section aria-label="开源关注" className="curation-home__feed site-section-motion">
        <ContentSectionNavigation current="open-source" />
        <OpenSourceStream entries={openSourceEntries} />
      </section>
    </main>
  );
}
