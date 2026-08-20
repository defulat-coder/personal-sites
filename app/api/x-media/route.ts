const MEDIA_HOST = "video.twimg.com";
const VIDEO_PATH = /^\/(?:amplify_video|ext_tw_video)\/.*\.mp4$/u;
const FORWARDED_HEADERS = [
  "accept-ranges",
  "cache-control",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
];

function getMediaUrl(request: Request): URL | null {
  const value = new URL(request.url).searchParams.get("url");
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === MEDIA_HOST && VIDEO_PATH.test(url.pathname)
      ? url
      : null;
  } catch {
    return null;
  }
}

// 重定向目标只允许留在 twimg CDN 域内：手动跟随一跳并逐跳校验，
// 否则上游一次 302 就能把本端点变成任意外站的开放代理。
function getRedirectUrl(location: string | null, base: URL): URL | null {
  if (!location) return null;
  try {
    const url = new URL(location, base);
    const isTwimgHost = url.hostname === MEDIA_HOST || url.hostname.endsWith(".twimg.com");
    return url.protocol === "https:" && isTwimgHost ? url : null;
  } catch {
    return null;
  }
}

async function fetchUpstream(mediaUrl: URL, headers: Headers, method: "GET" | "HEAD") {
  const first = await fetch(mediaUrl, { headers, method, redirect: "manual" });
  if (first.status < 300 || first.status >= 400) return first;

  const target = getRedirectUrl(first.headers.get("location"), mediaUrl);
  if (!target) return null;
  const second = await fetch(target, { headers, method, redirect: "manual" });
  // 第二跳仍是重定向则不再跟随，避免被多跳链带出 CDN 域。
  return second.status >= 300 && second.status < 400 ? null : second;
}

async function proxyMedia(request: Request, method: "GET" | "HEAD") {
  const mediaUrl = getMediaUrl(request);
  if (!mediaUrl) return new Response("不支持的视频地址。", { status: 400 });

  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  const upstream = await fetchUpstream(mediaUrl, headers, method);
  if (!upstream) return new Response("视频地址的重定向目标不受支持。", { status: 502 });
  const responseHeaders = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  // 让 CDN 缓存视频分段（含 Range 206），浏览器侧保持轻缓存；上游错误不缓存。
  if (upstream.status >= 200 && upstream.status < 300) {
    responseHeaders.set(
      "cache-control",
      "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
    );
  }
  responseHeaders.set("x-content-type-options", "nosniff");

  return new Response(method === "HEAD" ? null : upstream.body, {
    headers: responseHeaders,
    status: upstream.status,
    statusText: upstream.statusText,
  });
}

export function GET(request: Request) {
  return proxyMedia(request, "GET");
}

export function HEAD(request: Request) {
  return proxyMedia(request, "HEAD");
}
