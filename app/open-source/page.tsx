import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import styles from "@/components/open-source.module.css";
import { OpenSourceStream } from "@/components/open-source-stream";
import { SiteProfile } from "@/components/site-profile";
import { openSourceEntries } from "@/lib/open-source";

export const metadata: Metadata = {
  description: "陈远持续关注的开源项目：来自 GitHub Star 的人工筛选与个人判读。",
  title: "开源关注｜陈远",
};

export default function OpenSourcePage() {
  return (
    <main className="curation-home curation-open-source-page" id="site-main" tabIndex={-1}>
      <SiteProfile />

      <section aria-labelledby="open-source-title" className="curation-home__feed curation-open-source">
        <header className={styles.heading}>
          <div>
            <p>GitHub 收藏 · 个人判读</p>
            <h1 id="open-source-title">开源关注</h1>
          </div>
          <Link href="/">
            <ArrowLeft aria-hidden="true" />
            返回每日关注
          </Link>
        </header>

        <div className={styles.intro}>
          <p>
            这里记录我持续拆解的开源项目。它们来自 GitHub Star，但并非本人创建或维护；公开的只有经过筛选与补充判断的条目。
          </p>
          <p>仓库原始信息与我的关注理由分开呈现，避免把收藏误读为作品集。</p>
        </div>

        <OpenSourceStream entries={openSourceEntries} />
      </section>
    </main>
  );
}
