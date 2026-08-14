import type { Route } from "next";

import { SectionNavigationLink } from "@/components/section-navigation-link";

import styles from "./site-section-navigation.module.css";

export type SiteSection = "home" | "ai-news" | "daily" | "open-source" | "ask";

type SiteSectionNavigationProps = {
  current: SiteSection;
  includeHome?: boolean;
};

const contentSections: Array<{ href: Route; id: Exclude<SiteSection, "home">; label: string }> = [
  { href: "/?view=ai-news" as Route, id: "ai-news", label: "每日动态" },
  { href: "/?view=daily" as Route, id: "daily", label: "每日关注" },
  { href: "/?view=open-source" as Route, id: "open-source", label: "开源关注" },
  { href: "/ask" as Route, id: "ask", label: "问一问" },
];

const homeSection = { href: "/" as Route, id: "home" as const, label: "首页" };

function getTransition(current: SiteSection, destination: SiteSection) {
  if (current === "home") return "forward" as const;
  if (destination === "home") return "back" as const;
  return "swap" as const;
}

export function SiteSectionNavigation({ current, includeHome = false }: SiteSectionNavigationProps) {
  const sections = includeHome ? [homeSection, ...contentSections] : contentSections;
  return (
    <nav aria-label="内容导航" className={styles.navigation}>
      {sections.map((section) => (
        <SectionNavigationLink
          aria-current={current === section.id ? "page" : undefined}
          className={styles.link}
          from={current}
          href={section.href}
          key={`${current}-${section.id}`}
          to={section.id}
          transition={getTransition(current, section.id)}
        >
          {section.label}
        </SectionNavigationLink>
      ))}
    </nav>
  );
}

export function MobileSectionNavigation({ current }: Pick<SiteSectionNavigationProps, "current">) {
  return (
    <div className={styles.mobileNavigation}>
      <SiteSectionNavigation current={current} includeHome />
    </div>
  );
}

export function ContentSectionNavigation({ current }: Pick<SiteSectionNavigationProps, "current">) {
  return (
    <div className={styles.contentNavigation}>
      <SiteSectionNavigation current={current} />
    </div>
  );
}
