import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  Boxes,
  CircleDot,
  GitBranch,
  Library,
  Radar,
  UserRound,
  Workflow,
} from "lucide-react";

import { privateKnowledgeIsAvailable } from "@/lib/private-knowledge";
import { siteShell, type SiteNavigationKey } from "@/lib/site-shell";

const navigationIcons = {
  about: UserRound,
  curation: Radar,
  knowledge: Library,
  practice: Workflow,
  projects: Boxes,
} as const;

type SiteHeaderProps = {
  active?: SiteNavigationKey;
};

export function SiteHeader({ active }: SiteHeaderProps) {
  const github = siteShell.externalLinks[0];
  const yuque = siteShell.externalLinks[1];
  const knowledgeStatus = privateKnowledgeIsAvailable() ? "LOCAL PRIVATE OKF" : "PUBLIC OKF";

  return (
    <header className="site-header" data-site-header>
      <div className="site-header__inner">
        <div className="site-header__primary">
          <Link className="site-brand" href="/" aria-label="返回首页">
            <Image
              alt=""
              aria-hidden="true"
              className="site-brand__mark"
              height={32}
              src="/images/aihero-mark-authorized.svg"
              width={32}
            />
            <span>
              {siteShell.brand.label}
              {active ? <small><CircleDot aria-hidden="true" /> {knowledgeStatus}</small> : null}
            </span>
          </Link>

          <nav className="site-navigation" aria-label="主导航">
            {siteShell.navigation.map((item) => {
              const Icon = navigationIcons[item.anchor];
              return (
                <Link
                  aria-current={active === item.anchor ? "page" : undefined}
                  href={item.href}
                  key={item.anchor}
                >
                  <Icon aria-hidden="true" data-nav-icon={item.anchor} />
                  <span>{item.label}</span>
                </Link>
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
