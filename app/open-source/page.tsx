import type { Metadata } from "next";

import { OpenSourceStream } from "@/components/open-source-stream";
import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import { SiteProfile } from "@/components/site-profile";
import { getOpenSourceListEntries } from "@/lib/open-source";

// 公开投影随部署打包进 data/curation.sqlite，页面按五分钟 ISR 节奏更新。
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
