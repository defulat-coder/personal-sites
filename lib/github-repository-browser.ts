export type GitHubRepositoryTreeEntry = {
  path: string;
  size?: number;
  type: "blob" | "tree";
};

export type GitHubRepositoryTreeNode = GitHubRepositoryTreeEntry & {
  children: GitHubRepositoryTreeNode[];
  name: string;
};

export function normalizeGitHubPath(value: string) {
  if (!value || value.length > 512 || value.includes("\\") || value.includes("\0")) return null;
  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
  return segments.join("/");
}

export function githubRepositoryFileUrl(repositoryUrl: string, branch: string, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `${repositoryUrl.replace(/\/+$/u, "")}/blob/${encodeURIComponent(branch)}/${encodedPath}`;
}

export function buildGitHubRepositoryTree(entries: GitHubRepositoryTreeEntry[]) {
  const roots: GitHubRepositoryTreeNode[] = [];

  for (const entry of [...entries].sort((left, right) => left.path.localeCompare(right.path))) {
    const normalizedPath = normalizeGitHubPath(entry.path);
    if (!normalizedPath) continue;

    const segments = normalizedPath.split("/");
    let siblings = roots;
    let pathPrefix = "";
    for (const [index, name] of segments.entries()) {
      pathPrefix = pathPrefix ? `${pathPrefix}/${name}` : name;
      const isLeaf = index === segments.length - 1;
      let node = siblings.find((candidate) => candidate.name === name);
      if (!node) {
        node = {
          children: [],
          name,
          path: pathPrefix,
          type: isLeaf ? entry.type : "tree",
          ...(isLeaf && entry.size !== undefined ? { size: entry.size } : {}),
        };
        siblings.push(node);
      }
      if (isLeaf) {
        node.type = entry.type;
        if (entry.size !== undefined) node.size = entry.size;
      }
      siblings = node.children;
    }
  }

  const sortNodes = (nodes: GitHubRepositoryTreeNode[]) => {
    nodes.sort((left, right) => Number(right.type === "tree") - Number(left.type === "tree") || left.name.localeCompare(right.name));
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);
  return roots;
}
