"use client";

import { useEffect, useRef } from "react";

/** 只移动 sticky 的停靠位置，不压缩文档流，避免滚动阈值因头部收起而反复触发。 */
export function MobileProfileCollapse({ section }: { section: string }) {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const profile = marker.current?.parentElement;
    const navigation = profile?.querySelector<HTMLElement>("[data-mobile-navigation]");
    if (!profile || !navigation) return;
    const mobile = window.matchMedia("(max-width: 900px)");
    let frame = 0;
    let collapsed = false;
    const measure = () => {
      profile.style.setProperty("--mobile-profile-offset", `${navigation.offsetTop}px`);
    };
    const update = () => {
      frame = 0;
      const scrollTop = window.scrollY;
      // 首页是完整个人资料；其余阅读列表在滚动后只保留导航。
      if (!mobile.matches || section === "home" || section === "ask") collapsed = false;
      else if (scrollTop > 80) collapsed = true;
      else if (scrollTop < 16) collapsed = false;
      profile.toggleAttribute("data-mobile-collapsed", collapsed);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const onFocus = (event: FocusEvent) => {
      if (navigation.contains(event.target as Node)) return;
      collapsed = false;
      profile.removeAttribute("data-mobile-collapsed");
    };
    const observer = new ResizeObserver(measure);
    observer.observe(profile);
    observer.observe(navigation);
    measure();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    mobile.addEventListener("change", update);
    profile.addEventListener("focusin", onFocus);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      mobile.removeEventListener("change", update);
      profile.removeEventListener("focusin", onFocus);
      profile.removeAttribute("data-mobile-collapsed");
      profile.style.removeProperty("--mobile-profile-offset");
    };
  }, [section]);

  return <span hidden ref={marker} />;
}
