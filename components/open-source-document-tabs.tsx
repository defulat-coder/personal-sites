"use client";

import { useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

import styles from "@/components/open-source.module.css";
import { resolveGitHubReadmeUrl } from "@/lib/github-readme-url";

type OpenSourceDocumentTabsProps = {
  parsedMarkdown: string;
  readingSource: "official-zh-readme" | "kimi-translation";
  readingSourcePath: string | null;
  sourceUrl: string;
  sourceMarkdown: string;
  sourceTitle: string;
};

export function OpenSourceDocumentTabs({
  parsedMarkdown,
  readingSource,
  readingSourcePath,
  sourceUrl,
  sourceMarkdown,
  sourceTitle,
}: OpenSourceDocumentTabsProps) {
  const [documentView, setDocumentView] = useState<"parsed" | "source">("parsed");
  const isParsed = documentView === "parsed";
  const content = isParsed ? parsedMarkdown : sourceMarkdown;
  const documentPath = isParsed ? readingSourcePath ?? "README.md" : "README.md";

  return (
    <section aria-labelledby="open-source-document-title" className={`curation-detail__section ${styles.documentSection}`}>
      <div className={styles.documentHeader}>
        <h2 className="curation-detail__eyebrow" id="open-source-document-title">仓库文档</h2>
        <div aria-label="切换仓库文档版本" className={styles.documentTabs} role="tablist">
          <button
            aria-controls="parsed-document-panel"
            aria-selected={isParsed}
            className={styles.documentTab}
            id="parsed-document-tab"
            onClick={() => setDocumentView("parsed")}
            role="tab"
            type="button"
          >
            中文阅读版
          </button>
          <button
            aria-controls="source-document-panel"
            aria-selected={!isParsed}
            className={styles.documentTab}
            id="source-document-tab"
            onClick={() => setDocumentView("source")}
            role="tab"
            type="button"
          >
            {sourceTitle}
          </button>
        </div>
      </div>
      <p className={styles.documentHint}>
        {isParsed
          ? readingSource === "official-zh-readme"
            ? `内容直接采用仓库维护的中文 README${readingSourcePath ? `（${readingSourcePath}）` : ""}，未经过模型翻译。`
            : "中文阅读版只翻译说明性文字；术语、代码、命令、链接与原有 Markdown 结构保持不变。"
          : sourceTitle === "原始 README" ? "内容同步自仓库 README。" : "README 缺失时，展示用于生成解析的仓库结构证据。"}
      </p>
      <div
        aria-labelledby={isParsed ? "parsed-document-tab" : "source-document-tab"}
        className={styles.documentMarkdown}
        id={isParsed ? "parsed-document-panel" : "source-document-panel"}
        role="tabpanel"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          skipHtml
          urlTransform={(url) => defaultUrlTransform(resolveGitHubReadmeUrl(url, sourceUrl, documentPath))}
        >
          {content}
        </ReactMarkdown>
      </div>
    </section>
  );
}
