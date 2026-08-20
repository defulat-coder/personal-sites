import { SiteProfile } from "@/components/site-profile";

// 列表是动态渲染，超过客户端缓存窗口的返回/进入需要一次服务端往返，
// 骨架在往返期间立即呈现。
export default function AiNewsListLoading() {
  return (
    <main className="curation-home" id="site-main" tabIndex={-1}>
      <SiteProfile mobileSection="ai-news" />
      <section aria-label="每日动态" className="curation-home__feed">
        <div aria-busy="true" aria-live="polite" className="curation-home__stream-skeleton">
          <span />
          <span className="is-medium" />
          <span className="is-short" />
        </div>
      </section>
    </main>
  );
}
