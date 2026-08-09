const EXTERNAL_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/iu;

function getGitHubReadmeLocation(sourceUrl: string, sourcePath: string) {
  const source = new URL(sourceUrl);
  if (source.hostname !== "github.com") return null;

  const pathSegments = source.pathname.split("/").filter(Boolean);
  const blobIndex = pathSegments.indexOf("blob");
  const owner = pathSegments[0];
  const repository = pathSegments[1];
  const branch = pathSegments[blobIndex + 1];
  if (!owner || !repository || blobIndex < 2 || !branch) return null;

  return {
    branch,
    directory: sourcePath.split("/").slice(0, -1).filter(Boolean),
    owner,
    repository,
    source,
  };
}

/**
 * GitHub README 中的相对链接原本以仓库文件为基准；在个人站内渲染时，
 * 它们不能再相对当前页面解析，否则会跳到本站的无效路由。
 */
export function resolveGitHubReadmeUrl(url: string, sourceUrl: string, sourcePath = "README.md") {
  if (!url || url.startsWith("#") || EXTERNAL_URL.test(url)) return url;

  try {
    if (url.startsWith("?") || url.startsWith("/")) return new URL(url, sourceUrl).toString();

    const location = getGitHubReadmeLocation(sourceUrl, sourcePath);
    if (!location) return url;

    const repositoryDocumentRoot = `${location.owner}/${location.repository}/blob/${location.branch}`;
    const directory = location.directory.join("/");
    const base = `${location.source.origin}/${repositoryDocumentRoot}/${directory ? `${directory}/` : ""}`;
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

/**
 * Images embedded by a README must point to the raw asset rather than a
 * GitHub `blob` page. The latter is HTML, so browsers wait for a request that
 * cannot render as an image.
 */
export function resolveGitHubReadmeAssetUrl(url: string, sourceUrl: string, sourcePath = "README.md") {
  if (!url || EXTERNAL_URL.test(url)) return url;

  try {
    const location = getGitHubReadmeLocation(sourceUrl, sourcePath);
    if (!location || url.startsWith("?") || url.startsWith("/")) return new URL(url, sourceUrl).toString();

    const directory = location.directory.length > 0 ? `${location.directory.join("/")}/` : "";
    const base = `https://raw.githubusercontent.com/${location.owner}/${location.repository}/${location.branch}/${directory}`;
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}
