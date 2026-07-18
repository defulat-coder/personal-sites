import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/site-header";
import {
  collectionContent,
  identityContent,
  knowledgeContent,
  practiceContent,
  projectContent,
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
});
