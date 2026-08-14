import { createElement, type ComponentProps } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

import { OpenSourceDocumentView } from "@/components/open-source-document-view";
import { resolveGitHubReadmeAssetUrl, resolveGitHubReadmeUrl } from "@/lib/github-readme-url";
import { createMarkdownHeadingId } from "@/lib/markdown-anchor.mjs";

type OpenSourceDocumentTabsProps = {
  parsedMarkdown: string;
  readingSource: "official-zh-readme" | "kimi-translation";
  readingSourcePath: string | null;
  repository: string;
  repositoryUrl: string;
  slug: string;
  sourceUrl: string;
};

type MarkdownNode = {
  children?: MarkdownNode[];
  value?: unknown;
};

type MarkdownHeadingProps = ComponentProps<"h1"> & { node?: MarkdownNode };

function markdownNodeText(node: MarkdownNode | undefined): string {
  if (typeof node?.value === "string") return node.value;
  return node?.children?.map(markdownNodeText).join("") ?? "";
}

function createHeadingComponents() {
  const headingIds = new Map<string, number>();
  const heading = (tagName: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") => {
    const MarkdownHeading = ({ node, ...props }: MarkdownHeadingProps) => createElement(tagName, {
      ...props,
      id: createMarkdownHeadingId(markdownNodeText(node), headingIds),
    });
    MarkdownHeading.displayName = `Markdown${tagName.toUpperCase()}`;
    return MarkdownHeading;
  };
  return {
    h1: heading("h1"),
    h2: heading("h2"),
    h3: heading("h3"),
    h4: heading("h4"),
    h5: heading("h5"),
    h6: heading("h6"),
  };
}

export function OpenSourceDocumentTabs({
  parsedMarkdown,
  readingSource,
  readingSourcePath,
  repository,
  repositoryUrl,
  slug,
  sourceUrl,
}: OpenSourceDocumentTabsProps) {
  const headingComponents = createHeadingComponents();
  const parsedHint = readingSource === "official-zh-readme"
    ? `内容直接采用仓库维护的中文 README${readingSourcePath ? `（${readingSourcePath}）` : ""}，未经过模型翻译。`
    : "中文阅读版只翻译说明性文字；术语、代码、命令、链接与原有 Markdown 结构保持不变。";

  return (
    <OpenSourceDocumentView
      parsedHint={parsedHint}
      parsedPanel={(
        <ReactMarkdown
          components={{
            ...headingComponents,
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
      repository={repository}
      repositoryUrl={repositoryUrl}
      slug={slug}
    />
  );
}
