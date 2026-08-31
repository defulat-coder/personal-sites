"use client";

import { useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";

import styles from "@/components/open-source.module.css";
import { OpenSourceRepositoryBrowser } from "@/components/open-source-repository-browser";

type OpenSourceDocumentViewProps = {
  parsedHint: string;
  parsedPanel: ReactNode;
  repository: string;
  repositoryUrl: string;
  slug: string;
};

const subscribeToNothing = () => () => {};

// 文档版本切换是纯客户端状态，详情页因此可以保持 ISR；
// 深链 ?view=repository 在水合后生效，切换时同步回 URL 便于分享。
export function OpenSourceDocumentView({ parsedHint, parsedPanel, repository, repositoryUrl, slug }: OpenSourceDocumentViewProps) {
  const deepLinkedRepository = useSyncExternalStore(
    subscribeToNothing,
    () => new URLSearchParams(window.location.search).get("view") === "repository",
    () => false,
  );
  const [selection, setSelection] = useState<"parsed" | "repository" | null>(null);
  const [repositoryOpened, setRepositoryOpened] = useState(false);
  const view = selection ?? (deepLinkedRepository ? "repository" : "parsed");
  const isRepository = view === "repository";
  const showRepository = repositoryOpened || isRepository;

  const selectView = (nextView: "parsed" | "repository") => {
    setSelection(nextView);
    if (nextView === "repository") setRepositoryOpened(true);
    window.history.replaceState(
      null,
      "",
      nextView === "repository" ? `/open-source/${slug}?view=repository` : `/open-source/${slug}`,
    );
  };

  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, currentView: "parsed" | "repository") => {
    let nextView: "parsed" | "repository" | null = null;
    if (event.key === "ArrowRight") nextView = currentView === "parsed" ? "repository" : "parsed";
    if (event.key === "ArrowLeft") nextView = currentView === "parsed" ? "repository" : "parsed";
    if (event.key === "Home") nextView = "parsed";
    if (event.key === "End") nextView = "repository";
    if (!nextView) return;

    event.preventDefault();
    selectView(nextView);
    document.getElementById(`${nextView}-document-tab`)?.focus();
  };

  return (
    <section aria-labelledby="open-source-document-title" className={`curation-detail__section ${styles.documentSection}`}>
      <div className={styles.documentHeader}>
        <h2 className="curation-detail__eyebrow" id="open-source-document-title">仓库文档</h2>
        <div aria-label="切换仓库文档版本" className={styles.documentTabs} role="tablist">
          <button
            aria-controls="parsed-document-panel"
            aria-selected={!isRepository}
            className={styles.documentTab}
            id="parsed-document-tab"
            onKeyDown={(event) => moveTab(event, "parsed")}
            onClick={() => selectView("parsed")}
            role="tab"
            tabIndex={isRepository ? -1 : 0}
            type="button"
          >
            中文阅读版
          </button>
          <button
            aria-controls="repository-document-panel"
            aria-selected={isRepository}
            className={styles.documentTab}
            id="repository-document-tab"
            onKeyDown={(event) => moveTab(event, "repository")}
            onClick={() => selectView("repository")}
            role="tab"
            tabIndex={isRepository ? 0 : -1}
            type="button"
          >
            仓库结构
          </button>
        </div>
      </div>
      <p className={styles.documentHint}>
        {isRepository
          ? "文件树与内容按需从原始 GitHub 仓库读取；仅已公开的收藏仓库可访问。"
          : parsedHint}
      </p>
      <div
        aria-labelledby="parsed-document-tab"
        className={`article-markdown ${styles.documentPanel}`}
        hidden={isRepository}
        id="parsed-document-panel"
        role="tabpanel"
      >
        {parsedPanel}
      </div>
      {showRepository ? (
        <div
          aria-labelledby="repository-document-tab"
          className={styles.documentPanel}
          hidden={!isRepository}
          id="repository-document-panel"
          role="tabpanel"
        >
          <OpenSourceRepositoryBrowser repository={repository} repositoryUrl={repositoryUrl} slug={slug} />
        </div>
      ) : null}
    </section>
  );
}
