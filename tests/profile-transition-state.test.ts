import { animate } from "motion/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { beginProfileTransition, clearProfileTransition } from "@/components/profile-transition-state";

vi.mock("motion/react", () => ({
  animate: vi.fn(() => ({ stop: vi.fn() })),
}));

describe("beginProfileTransition", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="curation-home__avatar"></div>
      <div class="curation-home__identity"></div>
      <div class="curation-home__external-links"><a href="https://github.com">GitHub</a><a href="https://www.yuque.com">语雀</a><button>关于我</button></div>
    `;
    document.body.querySelectorAll<HTMLElement>("div").forEach((element) => {
      element.getBoundingClientRect = vi.fn(() => new DOMRect(16, 16, 72, 72));
    });
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

  it("stops discarded ghost animations on replacement and cleanup", () => {
    beginProfileTransition("home", "ask");
    const first = vi.mocked(animate).mock.results.slice(-3).map(result => result.value);
    beginProfileTransition("home", "works");
    first.forEach(controls => expect(controls.stop).toHaveBeenCalledOnce());
    const second = vi.mocked(animate).mock.results.slice(-3).map(result => result.value);
    clearProfileTransition();
    second.forEach(controls => expect(controls.stop).toHaveBeenCalledOnce());
    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(0);
    expect(document.documentElement.dataset.profileFeedHold).toBeUndefined();
  });

  it("does not create flying ghosts when the header has scrolled out of view", () => {
    const avatar = document.querySelector<HTMLElement>(".curation-home__avatar")!;
    vi.spyOn(avatar, "getBoundingClientRect").mockReturnValue(new DOMRect(16, -100, 52, 52));
    expect(beginProfileTransition("daily", "home")).toBe(false);
    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(0);
  });

  it("measures sources before appending identity and link ghosts together", () => {
    const order: string[] = [];
    const avatar = document.querySelector<HTMLElement>(".curation-home__avatar")!;
    const summary = document.querySelector<HTMLElement>(".curation-home__identity")!;
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
    expect(document.querySelector(".profile-transition-ghost--links")?.textContent).toBe("GitHub语雀关于我");
    expect(appendSpy).toHaveBeenCalledOnce();
    expect(appendSpy.mock.calls[0]).toHaveLength(3);
    expect(document.querySelectorAll(".profile-transition-ghost")).toHaveLength(3);
  });
});
