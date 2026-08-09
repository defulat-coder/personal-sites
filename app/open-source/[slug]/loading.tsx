import { ArrowLeft } from "lucide-react";

import styles from "@/components/open-source.module.css";
import { SiteProfile } from "@/components/site-profile";
import { ThemeToggle } from "@/components/theme-toggle";

export default function OpenSourceEntryLoading() {
  return (
    <main className="curation-home curation-detail curation-open-source-detail" id="site-main" tabIndex={-1}>
      <SiteProfile />

      <article aria-busy="true" aria-live="polite" className="curation-detail__article curation-open-source__article">
        <nav aria-label="返回" className="curation-detail__back">
          <span className={styles.loadingBack}>
            <ArrowLeft aria-hidden="true" />
            返回开源关注
          </span>
          <ThemeToggle />
        </nav>

        <header className="curation-detail__header">
          <p className={styles.loadingLabel}>正在打开仓库文档</p>
          <span aria-hidden="true" className={styles.loadingTitle} />
        </header>

        <section aria-label="正在读取中文阅读版" className={`curation-detail__section ${styles.documentSection}`}>
          <div className={styles.documentHeader}>
            <h2 className="curation-detail__eyebrow">仓库文档</h2>
          </div>
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
