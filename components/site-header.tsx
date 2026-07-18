import Image from "next/image";
import {
  BookOpen,
  Boxes,
  GitBranch,
  Library,
  UserRound,
  Workflow,
} from "lucide-react";

import { siteShell } from "@/lib/site-shell";

const navigationIcons = {
  about: UserRound,
  knowledge: Library,
  practice: Workflow,
  projects: Boxes,
} as const;

export function SiteHeader() {
  const github = siteShell.externalLinks[0];
  const yuque = siteShell.externalLinks[1];

  return (
    <header className="site-header" data-site-header>
      <div className="site-header__inner">
        <div className="site-header__primary">
          <a className="site-brand" href="#top" aria-label="返回页面顶部">
            <Image
              alt=""
              aria-hidden="true"
              className="site-brand__mark"
              height={32}
              src="/images/aihero-mark-authorized.svg"
              width={32}
            />
            <span>{siteShell.brand.label}</span>
          </a>

          <nav className="site-navigation" aria-label="主导航">
            {siteShell.navigation.map((item) => {
              const Icon = navigationIcons[item.anchor];
              return (
                <a href={item.href} key={item.anchor}>
                  <Icon aria-hidden="true" data-nav-icon={item.anchor} />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>
        </div>

        <nav className="site-header__external" aria-label="公开入口">
          <a href={github.href} rel="noreferrer" target="_blank">
            <GitBranch aria-hidden="true" data-nav-icon="github" />
            <span>{github.label}</span>
          </a>
          <a href={yuque.href} rel="noreferrer" target="_blank">
            <BookOpen aria-hidden="true" data-nav-icon="yuque" />
            <span>{yuque.label}</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
