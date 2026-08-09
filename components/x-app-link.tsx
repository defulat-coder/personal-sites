"use client";

import type { ComponentPropsWithoutRef, MouseEvent } from "react";

import { getXAppDeepLink, isMobileUserAgent } from "@/lib/x-app-link";

type XAppLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string;
};

/**
 * 在移动设备上由用户点击触发 X App 深链；未安装或无法切换时回退到网页。
 * 非 X 链接与桌面端始终保持普通链接行为。
 */
export function XAppLink({ href, onClick, target = "_blank", ...props }: XAppLinkProps) {
  const deepLink = getXAppDeepLink(href);

  function openXApp(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      !deepLink ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !isMobileUserAgent(navigator.userAgent)
    ) {
      return;
    }

    event.preventDefault();
    window.location.assign(deepLink);
    window.setTimeout(() => {
      if (document.visibilityState === "visible") window.location.assign(href);
    }, 1_100);
  }

  return <a {...props} href={href} onClick={openXApp} rel="noreferrer noopener" target={target} />;
}
