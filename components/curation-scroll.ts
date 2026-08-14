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

/**
 * Places a sentinel right after the stream and invokes `onNearEnd` whenever it
 * intersects the scroll target (expanded by `threshold` pixels at the bottom).
 * IntersectionObserver fires an initial callback on `observe`, so short pages
 * that do not fill the scroll target trigger `onNearEnd` immediately.
 * Returns a cleanup function that disconnects the observer and removes the sentinel.
 */
export function observeCurationScrollEnd(
  stream: Element,
  onNearEnd: () => void,
  threshold = 48,
): () => void {
  const target = getCurationScrollTarget(stream);
  const sentinel = document.createElement("div");
  sentinel.setAttribute("aria-hidden", "true");
  sentinel.dataset.curationScrollSentinel = "";
  stream.after(sentinel);

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onNearEnd();
    },
    {
      root: target instanceof HTMLElement ? target : null,
      rootMargin: `0px 0px ${threshold}px 0px`,
    },
  );
  observer.observe(sentinel);

  return () => {
    observer.disconnect();
    sentinel.remove();
  };
}
