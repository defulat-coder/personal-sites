import type { Metadata } from "next";

import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import { ContentSectionNavigation } from "@/components/site-section-navigation";
import { SiteProfile } from "@/components/site-profile";
import { WorksStream } from "@/components/works-stream";
import { listWorks } from "@/lib/works";

export const metadata: Metadata = {
  description: "陈远正在构建与维护的东西：本站自身与后续项目，附完整的构建笔记。",
  title: "构建｜陈远",
};

export default async function WorksPage() {
  const entries = await listWorks();
  return (
    <main className="curation-home" id="site-main" tabIndex={-1}>
      <SiteProfile mobileSection="works" />
      <SectionMotionLifecycle section="works" />
      <section aria-label="构建" className="curation-home__feed site-section-motion">
        <ContentSectionNavigation current="works" />
        <WorksStream entries={entries} />
      </section>
    </main>
  );
}
