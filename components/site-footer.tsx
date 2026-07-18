import Image from "next/image";
import { ArrowUp, BookOpen, GitBranch } from "lucide-react";

import { siteShell } from "@/lib/site-shell";

export function SiteFooter() {
  const github = siteShell.externalLinks[0];
  const yuque = siteShell.externalLinks[1];

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

        <nav aria-label="页脚导航">
          <h3>导航</h3>
          {siteShell.navigation.map((item) => (
            <a href={item.href} key={item.anchor}>
              {item.label}
            </a>
          ))}
        </nav>

        <nav aria-label="公开链接">
          <h3>公开入口</h3>
          <a href={github.href} rel="noreferrer" target="_blank">
            <GitBranch aria-hidden="true" /> {github.label}
          </a>
          <a href={yuque.href} rel="noreferrer" target="_blank">
            <BookOpen aria-hidden="true" /> {yuque.label}
          </a>
        </nav>

        <div className="site-footer__scope">
          <h3>当前范围</h3>
          <p>桌面端 · 1440×900</p>
          <p>OKF 索引 · 已核验</p>
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
