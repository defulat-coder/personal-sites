import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { publicSiteContent } from "@/lib/site-content";
import { siteFoundation } from "@/lib/site-foundation";
import { siteShell, type SiteNavigationKey } from "@/lib/site-shell";

type ContentPageFrameProps = {
  active: SiteNavigationKey;
  children: ReactNode;
};

export function ContentPageFrame({ active, children }: ContentPageFrameProps) {
  return (
    <>
      <a className="skip-link" href="#site-main">
        跳到主要内容
      </a>
      <div
        className="site-frame"
        data-shell-version={siteShell.version}
        data-site-shell
        id="top"
      >
        <SiteHeader active={active} />
        <main
          data-foundation-version={siteFoundation.version}
          data-public-content-hash={publicSiteContent.contentHash}
          data-site-foundation
          data-site-main
          id="site-main"
          tabIndex={-1}
        >
          {children}
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
