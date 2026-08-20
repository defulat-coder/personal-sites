import { ArrowLeft } from "lucide-react";

import styles from "@/components/open-source.module.css";
import { SiteProfile } from "@/components/site-profile";
import { ThemeToggle } from "@/components/theme-toggle";

// 文章骨架同时用作整页 loading 与页内 Suspense 边界的 fallback。
export function AiNewsDetailSkeleton() {
  return (
    <article aria-busy="true" aria-live="polite" className="ai-news-detail__article">
      <div className="ai-news-detail__topbar">
        <span className={styles.loadingBack}>
          <ArrowLeft aria-hidden="true" />
          返回每日动态
        </span>
        <div className="ai-news-detail__actions">
          <ThemeToggle />
        </div>
      </div>

      <header className="ai-news-detail__header">
        <p className={styles.loadingLabel}>正在打开每日动态</p>
        <span aria-hidden="true" className={styles.loadingTitle} />
      </header>

      <section aria-label="正在读取内容" className="ai-news-detail__section">
        <div className={styles.loadingDocument}>
          <span aria-hidden="true" className={styles.loadingLine} />
          <span aria-hidden="true" className={`${styles.loadingLine} ${styles.loadingLineMedium}`} />
          <span aria-hidden="true" className={`${styles.loadingLine} ${styles.loadingLineShort}`} />
        </div>
      </section>
    </article>
  );
}

export default function AiNewsDetailLoading() {
  return (
    <main className="curation-home curation-detail" id="site-main" tabIndex={-1}>
      <SiteProfile />
      <AiNewsDetailSkeleton />
    </main>
  );
}
