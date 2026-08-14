"use client";

import { useSearchParams } from "next/navigation";

import type { FocusView } from "@/components/focus-stream";
import { HomeMain, type HomeStreamData } from "@/components/home-main";
import type { SiteSection } from "@/components/site-section-navigation";

// ?view= 只影响移动端默认展示哪个版块，放在客户端读取，首页保持静态/ISR。
// 无 view 参数时桌面首屏是跨类型的今日快照，分区档案经刊头进入。
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
