import { AskChat } from "@/components/ask-chat";
import { SiteProfile } from "@/components/site-profile";

export default function AskPage() {
  return (
    <main className="curation-home ask-page" id="site-main" tabIndex={-1}>
      <SiteProfile />
      <AskChat />
    </main>
  );
}
