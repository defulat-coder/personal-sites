import type { Metadata } from "next";

import { CurationFeed } from "@/components/curation-feed";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { curationItems, curationTags } from "@/lib/curation";

export const metadata: Metadata = {
  description:
    "每天在 X 上关注的技术内容，经 AI 抓取、完整解析与人工筛选后的公开策展：GitHub 仓库深度解析、文章观点提炼与行业观察。",
  title: "每日策展｜陈远",
};

export default function CurationPage() {
  return (
    <WorkspaceFrame active="curation">
      <article className="curation-page" data-page-route="curation">
        <header className="curation-page__header">
          <p>DAILY CURATION</p>
          <h1>每日策展</h1>
          <span>
            每天在 X 上遇到值得关注的技术内容，由 AI 抓取并做完整解析——GitHub
            仓库还原架构与设计，文章提炼核心论点——经人工确认后公开在这里。
          </span>
        </header>
        <CurationFeed items={curationItems} tags={curationTags} />
      </article>
    </WorkspaceFrame>
  );
}
