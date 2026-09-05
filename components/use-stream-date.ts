"use client";

import { useEffect, useState, type RefObject } from "react";

/** 四个阅读栏目共用：工具栏跟随导航停靠，日期随当前可见分组更新。 */
export function useStreamDate(streamRef: RefObject<HTMLElement | null>, revision: unknown) {
  const [visibleDay, setVisibleDay] = useState<string | null>(null);
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const mobileNav = document.querySelector<HTMLElement>("[data-mobile-navigation]");
    const desktopNav = stream.closest(".site-section-motion")?.querySelector<HTMLElement>(":scope > nav");
    const media = window.matchMedia("(max-width: 900px)");
    const measure = () => {
      const nav = media.matches ? mobileNav : desktopNav;
      stream.style.setProperty("--stream-toolbar-top", `${nav?.getBoundingClientRect().height ?? 0}px`);
    };
    const observer = new ResizeObserver(measure);
    if (mobileNav) observer.observe(mobileNav);
    if (desktopNav) observer.observe(desktopNav);
    media.addEventListener("change", measure);
    measure();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", measure);
      stream.style.removeProperty("--stream-toolbar-top");
    };
  }, [streamRef]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;
    let frame = 0;
    const updateDay = () => {
      frame = 0;
      const toolbar = stream.querySelector<HTMLElement>(".stream-date-toolbar");
      if (!toolbar) return;
      const edge = toolbar.getBoundingClientRect().bottom + 1;
      const sections = stream.querySelectorAll<HTMLElement>("[data-stream-date]");
      let current = sections[0]?.dataset.streamDate ?? null;
      for (const section of sections) {
        if (section.getBoundingClientRect().top > edge) break;
        current = section.dataset.streamDate ?? null;
      }
      setVisibleDay(current);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(updateDay);
    };
    // 捕获桌面内容栏及手机页面的滚动，切换断点后也不遗留旧滚动容器。
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(stream);
    schedule();
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [revision, streamRef]);

  return visibleDay;
}
