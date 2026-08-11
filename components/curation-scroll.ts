type CurationScrollTarget = HTMLElement | Window;

export function getCurationScrollTarget(stream: Element): CurationScrollTarget {
  const feed = stream.closest(".curation-home__feed");
  if (
    feed instanceof HTMLElement
    && ["auto", "scroll"].includes(getComputedStyle(feed).overflowY)
  ) {
    return feed;
  }

  return window;
}

export function isNearCurationScrollEnd(target: CurationScrollTarget, threshold = 48) {
  if (target instanceof HTMLElement) {
    return target.scrollHeight - target.clientHeight - target.scrollTop <= threshold;
  }

  return document.documentElement.scrollHeight - window.innerHeight - window.scrollY <= threshold;
}
