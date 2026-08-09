const X_HOSTS = new Set(["x.com", "www.x.com", "twitter.com", "www.twitter.com"]);
const X_RESERVED_PATHS = new Set([
  "compose",
  "explore",
  "home",
  "i",
  "intent",
  "messages",
  "search",
  "settings",
]);

/** 返回可由 X 原生 App 处理的深链；其他链接保持网页打开。 */
export function getXAppDeepLink(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  if (!X_HOSTS.has(url.hostname.toLowerCase())) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  const statusIndex = segments.findIndex((segment) => segment === "status");
  const statusId = statusIndex >= 0 ? segments[statusIndex + 1] : undefined;
  if (statusId && /^\d+$/u.test(statusId)) {
    return `twitter://status?id=${statusId}`;
  }

  const [handle] = segments;
  if (segments.length === 1 && handle && !X_RESERVED_PATHS.has(handle.toLowerCase())) {
    return `twitter://user?screen_name=${encodeURIComponent(handle)}`;
  }

  return null;
}

export function isMobileUserAgent(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/u.test(userAgent);
}
