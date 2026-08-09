"use client";

import { useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

import styles from "@/components/open-source.module.css";
import { resolveGitHubReadmeUrl } from "@/lib/github-readme-url";
import { OpenSourceRepositoryBrowser } from "@/components/open-source-repository-browser";

type OpenSourceDocumentTabsProps = {
  parsedMarkdown: string;
  readingSource: "official-zh-readme" | "kimi-translation";
  readingSourcePath: string | null;
  repository: string;
  repositoryUrl: string;
  slug: string;
  sourceUrl: string;
};

export function OpenSourceDocumentTabs({
  parsedMarkdown,
  readingSource,
  readingSourcePath,
  repository,
  repositoryUrl,
  slug,
  sourceUrl,
}: OpenSourceDocumentTabsProps) {
  const [documentView, setDocumentView] = useState<"parsed" | "repository">("parsed");
  const isParsed = documentView === "parsed";
  const isRepository = documentView === "repository";

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
            aria-controls="repository-document-panel"
            aria-selected={isRepository}
            className={styles.documentTab}
            id="repository-document-tab"
            onClick={() => setDocumentView("repository")}
            role="tab"
            type="button"
          >
            仓库结构
          </button>
        </div>
      </div>
      <p className={styles.documentHint}>
        {isRepository
          ? "文件树与内容按需从原始 GitHub 仓库读取；仅已公开的收藏仓库可访问。"
          : isParsed
          ? readingSource === "official-zh-readme"
            ? `内容直接采用仓库维护的中文 README${readingSourcePath ? `（${readingSourcePath}）` : ""}，未经过模型翻译。`
            : "中文阅读版只翻译说明性文字；术语、代码、命令、链接与原有 Markdown 结构保持不变。"
          : null}
      </p>
      <div
        aria-labelledby={isRepository ? "repository-document-tab" : "parsed-document-tab"}
        className={styles.documentMarkdown}
        id={isRepository ? "repository-document-panel" : "parsed-document-panel"}
        role="tabpanel"
      >
        {isRepository ? (
          <OpenSourceRepositoryBrowser repository={repository} repositoryUrl={repositoryUrl} slug={slug} />
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            skipHtml
            urlTransform={(url) => defaultUrlTransform(resolveGitHubReadmeUrl(url, sourceUrl, readingSourcePath ?? "README.md"))}
          >
            {parsedMarkdown}
          </ReactMarkdown>
        )}
      </div>
    </section>
  );
}
