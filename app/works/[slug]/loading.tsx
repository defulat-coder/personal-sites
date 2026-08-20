import { ArrowLeft } from "lucide-react";

import styles from "@/components/open-source.module.css";
import { SiteProfile } from "@/components/site-profile";
import { ThemeToggle } from "@/components/theme-toggle";

export default function WorkLoading() {
  return (
    <main className="curation-home curation-detail" id="site-main" tabIndex={-1}>
      <SiteProfile />

      <article aria-busy="true" aria-live="polite" className="curation-detail__article">
        <nav aria-label="返回" className="curation-detail__back">
          <span className={styles.loadingBack}>
            <ArrowLeft aria-hidden="true" />
            返回构建
          </span>
          <ThemeToggle />
        </nav>

        <header className="curation-detail__header">
          <p className={styles.loadingLabel}>正在打开构建笔记</p>
          <span aria-hidden="true" className={styles.loadingTitle} />
        </header>

        <section aria-label="正在读取内容" className="curation-detail__section">
          <h2 className="curation-detail__eyebrow">正在读取内容</h2>
          <div className={styles.loadingDocument}>
            <span aria-hidden="true" className={styles.loadingLine} />
            <span aria-hidden="true" className={`${styles.loadingLine} ${styles.loadingLineMedium}`} />
            <span aria-hidden="true" className={`${styles.loadingLine} ${styles.loadingLineShort}`} />
          </div>
        </section>
      </article>
    </main>
  );
}
