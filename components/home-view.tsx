"use client";

import { useSearchParams } from "next/navigation";

import type { FocusView } from "@/components/focus-stream";
import { HomeMain, type HomeStreamData } from "@/components/home-main";
import type { SiteSection } from "@/components/site-section-navigation";

// 各阅读版块已有独立路径（/ai-news、/curation、/open-source）；首页的 ?view= 仅为旧链接
// 兼容保留，客户端读取后展示对应版块。无 view 参数时首屏是跨类型的今日快照。
export function HomeView(props: HomeStreamData) {
  const view = useSearchParams().get("view");
  const mobileSection: SiteSection = view === "open-source"
    ? "open-source"
    : view === "daily"
      ? "daily"
      : view === "ai-news"
        ? "ai-news"
        : "home";
  const initialView: FocusView = mobileSection === "home" ? "home" : mobileSection;
  return (
    <HomeMain
      {...props}
      initialView={initialView}
      mobileSection={mobileSection}
    />
  );
}
