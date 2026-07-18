import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";
import { SiteHeader } from "@/components/site-header";
import {
  collectionContent,
  identityContent,
  knowledgeContent,
  practiceContent,
  projectContent,
  publicSiteContent,
} from "@/lib/site-content";
import { siteShell, siteShellSchema } from "@/lib/site-shell";

describe("desktop site shell", () => {
  it("keeps every desktop navigation item aligned to one unique anchor", () => {
    expect(siteShellSchema.safeParse(siteShell).success).toBe(true);
    expect(siteShell.version).toBe(3);
    expect(siteShell.navigation.map((item) => item.href)).toEqual([
      "#projects",
      "#knowledge",
      "#practice",
      "#about",
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
});
