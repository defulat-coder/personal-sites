import type { Route } from "next";

import { SectionNavigationLink } from "@/components/section-navigation-link";

import styles from "./site-section-navigation.module.css";

export type SiteSection = "home" | "ai-news" | "daily" | "open-source" | "works" | "ask";

type SiteSectionNavigationProps = {
  current: SiteSection;
  includeHome?: boolean;
};

// 阅读版块（名词）与问一问（动作）分置：问一问归入身份轨，不占用刊头与版块序列。
const siblingSections: Array<{ href: Route; id: Exclude<SiteSection, "home" | "ask">; label: string }> = [
  { href: "/?view=ai-news" as Route, id: "ai-news", label: "每日动态" },
  { href: "/?view=daily" as Route, id: "daily", label: "推特点赞" },
  { href: "/?view=open-source" as Route, id: "open-source", label: "开源关注" },
  { href: "/works" as Route, id: "works", label: "构建" },
];

const askSection = { href: "/ask" as Route, id: "ask" as const, label: "问一问" };

const homeSection = { href: "/" as Route, id: "home" as const, label: "首页" };

function getTransition(current: SiteSection, destination: SiteSection) {
  if (current === "home") return "forward" as const;
  if (destination === "home") return "back" as const;
  return "swap" as const;
}

export function SiteSectionNavigation({ current, includeHome = false }: SiteSectionNavigationProps) {
  const sections = includeHome ? [homeSection, ...siblingSections] : siblingSections;
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

// 桌面刊头：当前版块是 Title 档刊名，兄弟版块收为 quiet 同行链接，
// 整个头部共享一条细线——导航不再使用 tab 语法。
export function ContentSectionNavigation({ current }: Pick<SiteSectionNavigationProps, "current">) {
  const allSections = [homeSection, ...siblingSections, askSection];
  const currentSection = allSections.find((section) => section.id === current) ?? siblingSections[0];
  const siblings = siblingSections.filter((section) => section.id !== currentSection.id);
  return (
    <nav aria-label="内容导航" className={styles.contentNavigation}>
      <span aria-current="page" className={styles.current}>
        {currentSection.label}
      </span>
      <div className={styles.siblings}>
        {siblings.map((section) => (
          <SectionNavigationLink
            className={styles.siblingLink}
            from={current}
            href={section.href}
            key={`${current}-${section.id}`}
            to={section.id}
            transition={getTransition(current, section.id)}
          >
            {section.label}
          </SectionNavigationLink>
        ))}
      </div>
    </nav>
  );
}
