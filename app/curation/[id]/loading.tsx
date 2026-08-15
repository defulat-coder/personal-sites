import { ArrowLeft } from "lucide-react";

import styles from "@/components/open-source.module.css";
import { SiteProfile } from "@/components/site-profile";
import { ThemeToggle } from "@/components/theme-toggle";

export default function CurationEntryLoading() {
  return (
    <main className="curation-home curation-detail curation-detail--spread" id="site-main" tabIndex={-1}>
      <SiteProfile />

      <article aria-busy="true" aria-live="polite" className="curation-detail__article">
        <nav aria-label="返回" className="curation-detail__back">
          <span className={styles.loadingBack}>
            <ArrowLeft aria-hidden="true" />
            返回推特点赞
          </span>
          <ThemeToggle />
        </nav>

        <header className="curation-detail__header">
          <p className={styles.loadingLabel}>正在打开推特点赞</p>
          <span aria-hidden="true" className={styles.loadingTitle} />
        </header>

        <div className="curation-detail__body">
          <section aria-label="正在读取原推" className="curation-detail__evidence">
            <h2 className="curation-detail__eyebrow">原推剪报</h2>
            <div className={styles.loadingDocument}>
              <span aria-hidden="true" className={styles.loadingLine} />
              <span aria-hidden="true" className={`${styles.loadingLine} ${styles.loadingLineMedium}`} />
              <span aria-hidden="true" className={`${styles.loadingLine} ${styles.loadingLineShort}`} />
            </div>
          </section>
          <section aria-label="正在读取解析" className="curation-detail__reading">
            <h2 className="curation-detail__eyebrow">深度解析</h2>
            <div className={styles.loadingDocument}>
              <span aria-hidden="true" className={styles.loadingLine} />
              <span aria-hidden="true" className={`${styles.loadingLine} ${styles.loadingLineMedium}`} />
              <span aria-hidden="true" className={`${styles.loadingLine} ${styles.loadingLineShort}`} />
            </div>
          </section>
        </div>
      </article>
    </main>
  );
}
