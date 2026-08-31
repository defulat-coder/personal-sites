import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { beginProfileTransition, clearProfileTransition } from "@/components/profile-transition-state";

vi.mock("motion/react", () => ({
  animate: vi.fn(() => ({ stop: vi.fn() })),
}));

describe("beginProfileTransition", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="curation-home__avatar"></div>
      <div class="curation-home__profile-summary"></div>
    `;
    window.sessionStorage.clear();
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
      matches: query === "(max-width: 900px)",
    })));
  });

  afterEach(() => {
    clearProfileTransition();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("measures both sources before appending both ghosts together", () => {
    const order: string[] = [];
    const avatar = document.querySelector<HTMLElement>(".curation-home__avatar")!;
    const summary = document.querySelector<HTMLElement>(".curation-home__profile-summary")!;
    vi.spyOn(avatar, "getBoundingClientRect").mockImplementation(() => {
      order.push("read-avatar");
      return new DOMRect(10, 20, 80, 80);
    });
    vi.spyOn(summary, "getBoundingClientRect").mockImplementation(() => {
      order.push("read-summary");
      return new DOMRect(12, 112, 240, 64);
    });
    const append = document.body.append.bind(document.body);
    const appendSpy = vi.spyOn(document.body, "append").mockImplementation((...nodes) => {
      order.push("append");
      append(...nodes);
    });

    beginProfileTransition("home", "ask");

    expect(order).toEqual(["read-avatar", "read-summary", "append"]);
    expect(appendSpy).toHaveBeenCalledOnce();
    expect(appendSpy.mock.calls[0]).toHaveLength(2);
    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(2);
  });
});
