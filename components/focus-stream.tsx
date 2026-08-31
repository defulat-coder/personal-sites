import { Suspense, type ReactNode } from "react";

import { FeedErrorBoundary, FeedRecoveryTarget } from "@/components/focus-stream-error-boundary";
import { ContentSectionNavigation } from "@/components/site-section-navigation";

export type FocusView = "ai-news" | "daily" | "open-source";

type FocusStreamProps = {
  children: ReactNode;
  initialView: FocusView;
};

const viewLabels: Record<FocusView, string> = {
  "ai-news": "每日动态",
  daily: "每日关注",
  "open-source": "开源关注",
};

function FeedSkeleton({ label }: { label: string }) {
  return (
    <div aria-atomic="true" aria-busy="true" className="curation-home__stream-skeleton" role="status">
      <p className="curation-home__stream-loading">正在读取{label}…</p>
      <span aria-hidden="true" />
      <span aria-hidden="true" className="is-medium" />
      <span aria-hidden="true" className="is-short" />
    </div>
  );
}

// 身份轨与刊头都在数据边界之外，流式响应只用真实列表替换骨架。
export function FocusStream({ children, initialView }: FocusStreamProps) {
  return (
    <section
      aria-label={viewLabels[initialView]}
      className="curation-home__feed site-section-motion"
      data-feed-recovery-root
      tabIndex={-1}
    >
      <ContentSectionNavigation current={initialView} />
      <FeedErrorBoundary label={viewLabels[initialView]}>
        <Suspense fallback={<FeedSkeleton label={viewLabels[initialView]} />}>
          <FeedRecoveryTarget>{children}</FeedRecoveryTarget>
        </Suspense>
      </FeedErrorBoundary>
    </section>
  );
}
