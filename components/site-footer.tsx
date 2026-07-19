import Image from "next/image";
import { ArrowUp } from "lucide-react";

import { siteShell } from "@/lib/site-shell";

export function SiteFooter() {
  return (
    <footer className="site-footer" data-site-footer>
      <div className="site-footer__grid">
        <div className="site-footer__brand">
          <Image
            alt=""
            aria-hidden="true"
            height={36}
            src="/images/aihero-mark-authorized.svg"
            width={36}
          />
          <strong>{siteShell.brand.label}</strong>
          <p>Agentic Software Engineering</p>
        </div>

        <div className="site-footer__scope">
          <h3>内容范围</h3>
          <p>桌面端 · 1440×900</p>
          <p>公开 OKF 索引 · 站内直读</p>
        </div>
      </div>

      <div className="site-footer__utility">
        <span>陈远 · Personal Site</span>
        <a href="#top">
          返回顶部 <ArrowUp aria-hidden="true" />
        </a>
      </div>
    </footer>
  );
}
