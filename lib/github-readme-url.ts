const EXTERNAL_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu;

/**
 * GitHub README 中的相对链接原本以仓库文件为基准；在个人站内渲染时，
 * 它们不能再相对当前页面解析，否则会跳到本站的无效路由。
 */
export function resolveGitHubReadmeUrl(url: string, sourceUrl: string, sourcePath = "README.md") {
  if (!url || url.startsWith("#") || EXTERNAL_URL.test(url)) return url;

  try {
    if (url.startsWith("?") || url.startsWith("/")) return new URL(url, sourceUrl).toString();

    const source = new URL(sourceUrl);
    const pathSegments = source.pathname.split("/").filter(Boolean);
    const blobIndex = pathSegments.indexOf("blob");
    if (blobIndex < 0 || !pathSegments[blobIndex + 1]) return url;

    const repositoryDocumentRoot = pathSegments.slice(0, blobIndex + 2).join("/");
    const directory = sourcePath.split("/").slice(0, -1).filter(Boolean).join("/");
    const base = `${source.origin}/${repositoryDocumentRoot}/${directory ? `${directory}/` : ""}`;
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}
