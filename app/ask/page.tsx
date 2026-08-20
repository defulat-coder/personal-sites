import type { Metadata } from "next";

import { AskChat } from "@/components/ask-chat";
import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import { SiteProfile } from "@/components/site-profile";

export const metadata: Metadata = {
  description: "基于陈远的公开策展、开源关注与每日动态，由归档助手回答你的问题。",
  title: "问一问｜陈远",
};

export default function AskPage() {
  return (
    <main className="curation-home ask-page" id="site-main" tabIndex={-1}>
      <SiteProfile mobileSection="ask" />
      <SectionMotionLifecycle section="ask" />
      <AskChat />
    </main>
  );
}
