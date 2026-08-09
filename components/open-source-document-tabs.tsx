import type { Route } from "next";
import Link from "next/link";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

import styles from "@/components/open-source.module.css";
import { resolveGitHubReadmeAssetUrl, resolveGitHubReadmeUrl } from "@/lib/github-readme-url";
import { OpenSourceRepositoryBrowser } from "@/components/open-source-repository-browser";

type OpenSourceDocumentTabsProps = {
  parsedMarkdown: string;
  readingSource: "official-zh-readme" | "kimi-translation";
  readingSourcePath: string | null;
  repository: string;
  repositoryUrl: string;
  slug: string;
  sourceUrl: string;
  view: "parsed" | "repository";
};

export function OpenSourceDocumentTabs({
  parsedMarkdown,
  readingSource,
  readingSourcePath,
  repository,
  repositoryUrl,
  slug,
  sourceUrl,
  view,
}: OpenSourceDocumentTabsProps) {
  const isParsed = view === "parsed";
  const isRepository = view === "repository";
  const documentHref = (documentView: "parsed" | "repository") => (
    documentView === "repository" ? `/open-source/${slug}?view=repository` : `/open-source/${slug}`
  ) as Route;

  return (
    <section aria-labelledby="open-source-document-title" className={`curation-detail__section ${styles.documentSection}`}>
      <div className={styles.documentHeader}>
        <h2 className="curation-detail__eyebrow" id="open-source-document-title">仓库文档</h2>
        <div aria-label="切换仓库文档版本" className={styles.documentTabs} role="tablist">
          <Link
            aria-controls="parsed-document-panel"
            aria-selected={isParsed}
            className={styles.documentTab}
            href={documentHref("parsed")}
            id="parsed-document-tab"
            role="tab"
            scroll={false}
          >
            中文阅读版
          </Link>
          <Link
            aria-controls="repository-document-panel"
            aria-selected={isRepository}
            className={styles.documentTab}
            href={documentHref("repository")}
            id="repository-document-tab"
            role="tab"
            scroll={false}
          >
            仓库结构
          </Link>
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
            components={{
              a: ({ children, href }) => (
                <a href={resolveGitHubReadmeUrl(href ?? "", sourceUrl, readingSourcePath ?? "README.md")}>
                  {children}
                </a>
              ),
              img: ({ alt, src }) => {
                if (typeof src !== "string") return null;
                return (
                  // README assets come from arbitrary public GitHub repositories.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={alt ?? ""}
                    loading="lazy"
                    src={resolveGitHubReadmeAssetUrl(src, sourceUrl, readingSourcePath ?? "README.md")}
                  />
                );
              },
            }}
            remarkPlugins={[remarkGfm]}
            skipHtml
            urlTransform={defaultUrlTransform}
          >
            {parsedMarkdown}
          </ReactMarkdown>
        )}
      </div>
    </section>
  );
}
