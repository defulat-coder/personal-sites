import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import styles from "./ask-answer-markdown.module.css";

type AskAnswerMarkdownProps = {
  source: string;
};

export function AskAnswerMarkdown({ source }: AskAnswerMarkdownProps) {
  return (
    <div className={styles.root}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
        {source}
      </ReactMarkdown>
    </div>
  );
}
