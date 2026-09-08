import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SiteProfile } from "@/components/site-profile";
import { ThemeToggle } from "@/components/theme-toggle";

export default function NotFound() {
  return (
    <main className="curation-home curation-detail" id="site-main" tabIndex={-1}>
      <SiteProfile />
      <article className="ai-news-detail__article">
        <nav aria-label="返回" className="ai-news-detail__topbar">
          <Link className="ai-news-detail__back" href="/">
            <ArrowLeft aria-hidden="true" />
            返回首页
          </Link>
          <ThemeToggle />
        </nav>
        <header className="ai-news-detail__header">
          <p className="ai-news-detail__kicker">404 · 页面未找到</p>
          <h1>这页档案不在这里</h1>
        </header>
        <section className="ai-news-detail__section ai-news-detail__lead">
          <p>链接可能已经变更，或这份内容尚未公开。可以回到首页，继续阅读最新动态。</p>
        </section>
        <footer className="ai-news-detail__source">
          <Link className="ai-news-detail__cta" href="/ai-news">阅读每日动态</Link>
        </footer>
      </article>
    </main>
  );
}
