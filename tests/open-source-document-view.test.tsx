import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OpenSourceDocumentView } from "@/components/open-source-document-view";

vi.mock("@/components/open-source-repository-browser", () => ({
  OpenSourceRepositoryBrowser: () => <div>仓库结构内容</div>,
}));

const props = {
  parsedHint: "中文阅读提示",
  parsedPanel: <p>中文阅读内容</p>,
  repository: "owner/repository",
  repositoryUrl: "https://github.com/owner/repository",
  slug: "owner-repository",
};

describe("OpenSourceDocumentView tabs", () => {
  beforeEach(() => window.history.replaceState(null, "", "/open-source/owner-repository"));

  afterEach(cleanup);

  it("uses roving focus and activates tabs with Arrow, Home, and End keys", () => {
    render(<OpenSourceDocumentView {...props} />);
    const parsed = screen.getByRole("tab", { name: "中文阅读版" });
    const repository = screen.getByRole("tab", { name: "仓库结构" });

    expect(parsed.tabIndex).toBe(0);
    expect(repository.tabIndex).toBe(-1);

    parsed.focus();
    fireEvent.keyDown(parsed, { key: "ArrowRight" });
    expect(document.activeElement).toBe(repository);
    expect(repository.getAttribute("aria-selected")).toBe("true");
    expect(repository.tabIndex).toBe(0);
    expect(parsed.tabIndex).toBe(-1);

    fireEvent.keyDown(repository, { key: "ArrowRight" });
    expect(document.activeElement).toBe(parsed);
    expect(parsed.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(parsed, { key: "End" });
    expect(document.activeElement).toBe(repository);
    expect(repository.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(repository, { key: "Home" });
    expect(document.activeElement).toBe(parsed);
    expect(parsed.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(parsed, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(repository);
    expect(repository.getAttribute("aria-selected")).toBe("true");
  });

  it("keeps pointer activation and URL sharing behavior", () => {
    render(<OpenSourceDocumentView {...props} />);
    const repository = screen.getByRole("tab", { name: "仓库结构" });

    fireEvent.click(repository);

    expect(repository.getAttribute("aria-selected")).toBe("true");
    expect(repository.tabIndex).toBe(0);
    expect(window.location.pathname).toBe("/open-source/owner-repository");
    expect(window.location.search).toBe("?view=repository");
    expect((screen.getByRole("tabpanel", { name: "仓库结构" }) as HTMLDivElement).hidden).toBe(false);
  });
});
