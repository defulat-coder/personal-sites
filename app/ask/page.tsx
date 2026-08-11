import { AskChat } from "@/components/ask-chat";
import { SectionMotionLifecycle } from "@/components/section-motion-lifecycle";
import { SiteProfile } from "@/components/site-profile";

export default function AskPage() {
  return (
    <main className="curation-home ask-page" id="site-main" tabIndex={-1}>
      <SiteProfile mobileSection="ask" />
      <SectionMotionLifecycle section="ask" />
      <AskChat />
    </main>
  );
}
