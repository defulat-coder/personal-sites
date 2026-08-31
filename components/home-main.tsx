import type { ReactNode } from "react";

import { FocusStream, type FocusView } from "@/components/focus-stream";
import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import type { SiteSection } from "@/components/site-section-navigation";
import { SiteProfile } from "@/components/site-profile";

type HomeMainProps = {
  children: ReactNode;
  initialView: FocusView;
  mobileSection: SiteSection;
};

// 首页壳始终只渲染一次；只有 children 对应的数据列表会在 FocusStream 内流式替换。
export function HomeMain({ children, initialView, mobileSection }: HomeMainProps) {
  return (
    <main className={`curation-home${mobileSection === "home" ? " curation-home--mobile-home" : ""}`} id="site-main" tabIndex={-1}>
      <SiteProfile animateOnFirstHomeVisit mobileSection={mobileSection} />
      <SectionMotionLifecycle section={mobileSection} />
      <FocusStream initialView={initialView}>{children}</FocusStream>
    </main>
  );
}
