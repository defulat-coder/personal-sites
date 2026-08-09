import { describe, expect, it } from "vitest";

import { openSourceCategories, openSourceDimensions } from "../lib/open-source-types";
import { resolveGitHubReadmeUrl } from "../lib/github-readme-url";
import { buildGitHubRepositoryTree, githubRepositoryFileUrl, normalizeGitHubPath } from "../lib/github-repository-browser";
import { openSourceSeedEntries } from "../lib/open-source-seed";

describe("open-source curation", () => {
  it("only exposes a curated public subset with stable, unique routes", () => {
    expect(openSourceSeedEntries).toHaveLength(10);
    expect(new Set(openSourceSeedEntries.map((entry) => entry.slug)).size).toBe(openSourceSeedEntries.length);
    expect(openSourceSeedEntries.every((entry) => entry.repositoryUrl.startsWith("https://github.com/"))).toBe(true);
    expect(openSourceSeedEntries.every((entry) => entry.evidence.kind === "readme")).toBe(true);
    expect(openSourceSeedEntries.every((entry) => entry.evidence.url.includes("/README"))).toBe(true);
  });

  it("keeps skills and agent systems as distinct primary categories", () => {
    expect(openSourceCategories.map((category) => category.id)).toEqual([
      "all",
      "skills",
      "agents",
      "context",
      "tools",
    ]);
    expect(openSourceSeedEntries.some((entry) => entry.category === "skills")).toBe(true);
    expect(openSourceSeedEntries.some((entry) => entry.category === "agents")).toBe(true);
    expect(openSourceDimensions.some((dimension) => dimension.id === "agent-control")).toBe(true);
    expect(openSourceSeedEntries.some((entry) => entry.dimensions.includes("multi-agent"))).toBe(true);
  });

  it("keeps the publish allowlist bounded even when the Star synchronizer has all repositories", () => {
    expect(openSourceSeedEntries.find((entry) => entry.slug === "herdr")).toMatchObject({
      repository: "herdrdev/herdr",
      category: "agents",
    });
    expect(openSourceSeedEntries.find((entry) => entry.slug === "not-starred")).toBeUndefined();
  });

  it("resolves README-relative links against the repository instead of this site", () => {
    const sourceUrl = "https://github.com/jakubkrehel/skills/blob/main/README.md";
    expect(resolveGitHubReadmeUrl("skills/better-interface/SKILL.md", sourceUrl)).toBe(
      "https://github.com/jakubkrehel/skills/blob/main/skills/better-interface/SKILL.md",
    );
    expect(resolveGitHubReadmeUrl("https://interfaces.dev/", sourceUrl)).toBe("https://interfaces.dev/");
    expect(resolveGitHubReadmeUrl("#install", sourceUrl)).toBe("#install");
  });

  it("builds a safe navigable GitHub repository tree", () => {
    expect(normalizeGitHubPath("src/components/App.tsx")).toBe("src/components/App.tsx");
    expect(normalizeGitHubPath("../.env")).toBeNull();
    expect(normalizeGitHubPath("src//App.tsx")).toBeNull();
    expect(githubRepositoryFileUrl("https://github.com/example/repo", "main", "src/App.tsx")).toBe(
      "https://github.com/example/repo/blob/main/src/App.tsx",
    );

    expect(buildGitHubRepositoryTree([
      { path: "src/App.tsx", size: 120, type: "blob" },
      { path: "README.md", size: 20, type: "blob" },
      { path: "src", type: "tree" },
    ])).toMatchObject([
      { name: "src", type: "tree", children: [{ name: "App.tsx", path: "src/App.tsx", type: "blob" }] },
      { name: "README.md", type: "blob" },
    ]);
  });
});
