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

async function proxyMedia(request: Request, method: "GET" | "HEAD") {
  const mediaUrl = getMediaUrl(request);
  if (!mediaUrl) return new Response("不支持的视频地址。", { status: 400 });

  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("range", range);

  const upstream = await fetch(mediaUrl, { headers, method, redirect: "follow" });
  const responseHeaders = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
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
