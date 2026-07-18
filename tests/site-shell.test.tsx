import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AboutPage from "@/app/about/page";
import KnowledgePage from "@/app/knowledge/page";
import HomePage from "@/app/page";
import PracticePage from "@/app/practice/page";
import ProjectsPage from "@/app/projects/page";
import { SiteHeader } from "@/components/site-header";
import {
  collectionContent,
  identityContent,
  knowledgeContent,
  practiceContent,
  projectContent,
  publicSiteContent,
  summarySupportsMetric,
} from "@/lib/site-content";
import { siteShell, siteShellSchema } from "@/lib/site-shell";

describe("desktop site shell", () => {
  it("routes every primary navigation item to a real content page", () => {
    expect(siteShellSchema.safeParse(siteShell).success).toBe(true);
    expect(siteShell.version).toBe(4);
    expect(siteShell.navigation.map((item) => item.href)).toEqual([
      "/projects",
      "/knowledge",
      "/practice",
      "/about",
    ]);
  });

  it("renders the measured desktop navigation and public entry points", () => {
    const { container } = render(<SiteHeader />);

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "公开入口" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "GitHub" }).getAttribute("href")).toBe(
      "https://github.com/defulat-coder",
    );
    expect(screen.getByRole("link", { name: "语雀" }).getAttribute("href")).toBe(
      "https://www.yuque.com/defulat-coder",
    );
    expect(
      Array.from(container.querySelectorAll("[data-nav-icon]"), (icon) =>
        icon.getAttribute("data-nav-icon"),
      ),
    ).toEqual(["projects", "knowledge", "practice", "about", "github", "yuque"]);
  });

  it("maps the OKF index projection into every desktop page section", () => {
    expect(identityContent.id).toBe("identity-profile");
    expect(Object.values(collectionContent).map((item) => item.id)).toEqual([
      "overview-github",
      "overview-yuque",
      "overview-agent-history",
    ]);
    expect(projectContent.map((item) => item.id)).toEqual([
      "project-mx-agent",
      "project-health-pilot",
      "project-ddd-hr",
      "project-agno-cookbook-cn",
    ]);
    expect(knowledgeContent).toHaveLength(4);
    expect(practiceContent).toHaveLength(6);
    expect(practiceContent.map((item) => item.image)).toEqual([
      "/images/source/grid-01.webp",
      "/images/source/grid-02.webp",
      "/images/source/grid-03.webp",
      "/images/source/grid-04.webp",
      "/images/source/grid-05.webp",
      "/images/source/grid-06.webp",
    ]);
  });

  it("matches indexed metrics as complete numbers", () => {
    expect(summarySupportsMetric("共有 15 个知识库", "15")).toBe(true);
    expect(summarySupportsMetric("共有 115 个知识库", "15")).toBe(false);
    expect(summarySupportsMetric("共 15,000 条记录", "15")).toBe(false);
  });

  it("renders every approved projection claim into the homepage", () => {
    const { container } = render(<HomePage />);

    expect(
      container
        .querySelector("[data-site-main]")
        ?.getAttribute("data-public-content-hash"),
    ).toBe(publicSiteContent.contentHash);
    for (const item of publicSiteContent.items) {
      const elements = Array.from(
        container.querySelectorAll(`[data-content-id="${item.id}"]`),
      );
      const text = elements.map((element) => element.textContent).join(" ");
      const hrefs = elements.flatMap((element) => [
        ...(element.matches("a") ? [element.getAttribute("href")] : []),
        ...Array.from(element.querySelectorAll("a"), (anchor) =>
          anchor.getAttribute("href"),
        ),
      ]);

      expect(elements.length).toBeGreaterThan(0);
      expect(text).toContain(item.title);
      expect(text).toContain(item.summary);
      if (item.url) {
        expect(hrefs).toContain(item.url);
      }
    }
  });

  it("renders the project index as a real content page", () => {
    const { container } = render(<ProjectsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "项目索引" })).toBeTruthy();
    expect(
      container.querySelector('[data-site-header] a[href="/projects"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");
    for (const item of [collectionContent.projects, ...projectContent]) {
      const content = Array.from(
        container.querySelectorAll(`[data-content-id="${item.id}"]`),
      )
        .map((element) => element.textContent)
        .join(" ");
      expect(content).toContain(item.title);
      expect(content).toContain(item.summary);
    }
  });

  it("renders the knowledge index as a real content page", () => {
    const { container } = render(<KnowledgePage />);

    expect(screen.getByRole("heading", { level: 1, name: "知识索引" })).toBeTruthy();
    expect(
      container.querySelector('[data-site-header] a[href="/knowledge"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");
    for (const item of [collectionContent.knowledge, ...knowledgeContent]) {
      const content = Array.from(
        container.querySelectorAll(`[data-content-id="${item.id}"]`),
      )
        .map((element) => element.textContent)
        .join(" ");
      expect(content).toContain(item.title);
      expect(content).toContain(item.summary);
    }
  });

  it("renders the practice index as a real content page", () => {
    const { container } = render(<PracticePage />);

    expect(screen.getByRole("heading", { level: 1, name: "实践索引" })).toBeTruthy();
    expect(
      container.querySelector('[data-site-header] a[href="/practice"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");
    for (const item of [collectionContent.practice, ...practiceContent]) {
      const content = Array.from(
        container.querySelectorAll(`[data-content-id="${item.id}"]`),
      )
        .map((element) => element.textContent)
        .join(" ");
      expect(content).toContain(item.title);
      expect(content).toContain(item.summary);
    }
  });

  it("renders the about index as a real content page", () => {
    const { container } = render(<AboutPage />);

    expect(screen.getByRole("heading", { level: 1, name: "关于我" })).toBeTruthy();
    expect(
      container.querySelector('[data-site-header] a[href="/about"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");
    for (const item of [identityContent, ...Object.values(collectionContent)]) {
      const content = Array.from(
        container.querySelectorAll(`[data-content-id="${item.id}"]`),
      )
        .map((element) => element.textContent)
        .join(" ");
      expect(content).toContain(item.title);
      expect(content).toContain(item.summary);
    }
  });
});
