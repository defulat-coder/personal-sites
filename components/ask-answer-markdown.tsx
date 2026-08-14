import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import styles from "./ask-answer-markdown.module.css";

type AskAnswerMarkdownProps = {
  source: string;
};

// 流式输出期间 source 不变的历史气泡靠 memo 跳过 unified 重解析。
export const AskAnswerMarkdown = memo(function AskAnswerMarkdown({ source }: AskAnswerMarkdownProps) {
  return (
    <div className={styles.root}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
        {source}
      </ReactMarkdown>
    </div>
  );
});
