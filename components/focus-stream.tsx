"use client";

import { useEffect, useState } from "react";

import { CurationStream } from "@/components/curation-stream";
import styles from "@/components/focus-stream.module.css";
import { OpenSourceStream } from "@/components/open-source-stream";
import type { CurationListItem } from "@/lib/curation-types";
import type { OpenSourceListEntry } from "@/lib/open-source-types";

export type FocusView = "daily" | "open-source";

type FocusStreamProps = {
  initialHasMore: boolean;
  initialItems: CurationListItem[];
  initialView: FocusView;
  openSourceEntries: OpenSourceListEntry[];
};

const viewCopy: Record<FocusView, { title: string }> = {
  daily: {
    title: "每日关注",
  },
  "open-source": {
    title: "开源关注",
  },
};

function getViewFromSearch(search: string): FocusView {
  return new URLSearchParams(search).get("view") === "open-source" ? "open-source" : "daily";
}

export function FocusStream({ initialHasMore, initialItems, initialView, openSourceEntries }: FocusStreamProps) {
  const [view, setView] = useState<FocusView>(initialView);

  useEffect(() => {
    const syncViewWithHistory = () => setView(getViewFromSearch(window.location.search));
    window.addEventListener("popstate", syncViewWithHistory);
    return () => window.removeEventListener("popstate", syncViewWithHistory);
  }, []);

  const changeView = (nextView: FocusView) => {
    if (nextView === view) return;

    const url = new URL(window.location.href);
    if (nextView === "open-source") url.searchParams.set("view", "open-source");
    else url.searchParams.delete("view");

    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
    setView(nextView);
  };

  return (
    <section aria-labelledby="focus-stream-title" className="curation-home__feed">
      <header className={styles.header}>
        <div>
          <h2 id="focus-stream-title">{viewCopy[view].title}</h2>
        </div>

        <nav aria-label="内容切换" className={styles.switcher} role="tablist">
          {(["daily", "open-source"] as const).map((item) => (
            <button
              aria-controls={`${item}-panel`}
              aria-selected={view === item}
              className={styles.switcherButton}
              id={`${item}-tab`}
              key={item}
              onClick={() => changeView(item)}
              role="tab"
              type="button"
            >
              {viewCopy[item].title}
            </button>
          ))}
        </nav>
      </header>

      <div
        aria-labelledby="daily-tab"
        className={styles.panel}
        hidden={view !== "daily"}
        id="daily-panel"
        role="tabpanel"
      >
        <CurationStream active={view === "daily"} initialHasMore={initialHasMore} initialItems={initialItems} />
      </div>

      <div
        aria-labelledby="open-source-tab"
        className={styles.panel}
        hidden={view !== "open-source"}
        id="open-source-panel"
        role="tabpanel"
      >
        <OpenSourceStream entries={openSourceEntries} />
      </div>
    </section>
  );
}
