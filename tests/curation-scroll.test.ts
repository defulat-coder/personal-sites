// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCurationScrollTarget,
  observeCurationScrollEnd,
} from "../components/curation-scroll";

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  disconnected: boolean;
  observed: Element[];
  options: IntersectionObserverInit | undefined;
};

const observers: ObserverRecord[] = [];

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = "";
  readonly scrollMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  private readonly record: ObserverRecord;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.record = { callback, disconnected: false, observed: [], options };
    observers.push(this.record);
  }

  disconnect() {
    this.record.disconnected = true;
  }

  observe(target: Element) {
    this.record.observed.push(target);
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  unobserve(target: Element) {
    this.record.observed = this.record.observed.filter((element) => element !== target);
  }
}

function triggerIntersection(record: ObserverRecord, isIntersecting: boolean) {
  record.callback(
    [{ isIntersecting } as IntersectionObserverEntry],
    {} as IntersectionObserver,
  );
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  observers.length = 0;
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

    const target = getCurationScrollTarget(stream);

    expect(target).toBe(feed);

    observeCurationScrollEnd(stream, () => {});
    expect(observers).toHaveLength(1);
    expect(observers[0].options?.root).toBe(feed);
    expect(observers[0].options?.rootMargin).toBe("0px 0px 48px 0px");
  });

  it("keeps window scrolling as the mobile fallback", () => {
    document.body.innerHTML = `
      <section class="curation-home__feed" style="overflow-y: visible">
        <ol class="curation-home__stream"></ol>
      </section>
    `;
    const stream = document.querySelector<HTMLOListElement>(".curation-home__stream")!;

    expect(getCurationScrollTarget(stream)).toBe(window);

    observeCurationScrollEnd(stream, () => {});
    expect(observers).toHaveLength(1);
    expect(observers[0].options?.root).toBeNull();
  });
});

describe("observeCurationScrollEnd", () => {
  it("invokes the callback when the sentinel intersects the scroll target", () => {
    document.body.innerHTML = `<ol class="curation-home__stream"></ol>`;
    const stream = document.querySelector<HTMLOListElement>(".curation-home__stream")!;
    const onNearEnd = vi.fn();

    observeCurationScrollEnd(stream, onNearEnd);

    const record = observers[0];
    expect(record.observed).toHaveLength(1);
    expect(record.observed[0]).toBe(stream.nextElementSibling);

    triggerIntersection(record, false);
    expect(onNearEnd).not.toHaveBeenCalled();

    triggerIntersection(record, true);
    expect(onNearEnd).toHaveBeenCalledTimes(1);
  });

  it("disconnects the observer and removes the sentinel on cleanup", () => {
    document.body.innerHTML = `<ol class="curation-home__stream"></ol>`;
    const stream = document.querySelector<HTMLOListElement>(".curation-home__stream")!;

    const cleanup = observeCurationScrollEnd(stream, () => {});
    const sentinel = stream.nextElementSibling;
    expect(sentinel).not.toBeNull();

    cleanup();

    expect(observers[0].disconnected).toBe(true);
    expect(stream.nextElementSibling).toBeNull();
    expect(sentinel?.isConnected).toBe(false);
  });
});
