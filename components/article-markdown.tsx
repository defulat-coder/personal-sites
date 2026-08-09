import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ArticleMarkdownProps = {
  source: string;
};

export function ArticleMarkdown({ source }: ArticleMarkdownProps) {
  return (
    <div className="article-markdown">
      <ReactMarkdown
        components={{
          a: ({ children, href }) => (
            <a href={href} rel="noreferrer noopener" target="_blank">
              {children}
            </a>
          ),
          img: ({ alt, src }) => (
            <span className="article-markdown__image-link">
              图片资源：
              {typeof src === "string" ? (
                <a href={src} rel="noreferrer noopener" target="_blank">
                  {alt || "打开原图"}
                </a>
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
