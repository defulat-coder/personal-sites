import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { XAppLink } from "@/components/x-app-link";

type ArticleMarkdownProps = {
  source: string;
};

export function ArticleMarkdown({ source }: ArticleMarkdownProps) {
  return (
    <div className="article-markdown">
      <ReactMarkdown
        components={{
          a: ({ children, href }) => (
            <XAppLink href={href ?? "#"}>
              {children}
            </XAppLink>
          ),
          img: ({ alt, src }) => (
            <span className="article-markdown__image-link">
              图片资源：
              {typeof src === "string" ? (
                <XAppLink href={src}>
                  {alt || "打开原图"}
                </XAppLink>
              ) : (
                alt || "无可用地址"
              )}
            </span>
          ),
        }}
        remarkPlugins={[remarkGfm]}
        skipHtml
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
