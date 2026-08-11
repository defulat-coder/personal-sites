// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import {
  getCurationScrollTarget,
  isNearCurationScrollEnd,
} from "../components/curation-scroll";

function setScrollMetrics(element: HTMLElement, metrics: {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
}) {
  for (const [key, value] of Object.entries(metrics)) {
    Object.defineProperty(element, key, { configurable: true, value });
  }
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("curation scroll target", () => {
  it("uses the independently scrolling desktop feed instead of the page window", () => {
    document.body.innerHTML = `
      <section class="curation-home__feed" style="overflow-y: auto">
        <ol class="curation-home__stream"></ol>
      </section>
    `;
    const feed = document.querySelector<HTMLElement>(".curation-home__feed")!;
    const stream = document.querySelector<HTMLOListElement>(".curation-home__stream")!;
    setScrollMetrics(feed, { clientHeight: 720, scrollHeight: 2464, scrollTop: 1744 });

    const target = getCurationScrollTarget(stream);

    expect(target).toBe(feed);
    expect(isNearCurationScrollEnd(target)).toBe(true);
  });

  it("keeps window scrolling as the mobile fallback", () => {
    document.body.innerHTML = `
      <section class="curation-home__feed" style="overflow-y: visible">
        <ol class="curation-home__stream"></ol>
      </section>
    `;
    const stream = document.querySelector<HTMLOListElement>(".curation-home__stream")!;

    expect(getCurationScrollTarget(stream)).toBe(window);
  });
});
