import "server-only";

import { z } from "zod";

import {
  githubRepositoryFileUrl,
  normalizeGitHubPath,
  type GitHubRepositoryTreeEntry,
} from "@/lib/github-repository-browser";
import { getOpenSourceEntry } from "@/lib/open-source";

const MAX_FILE_BYTES = 512 * 1024;
const MAX_TREE_ENTRIES = 6_000;
const repositorySchema = z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u);
const repositoryMetadataSchema = z.object({ default_branch: z.string().min(1) });
const repositoryTreeSchema = z.object({
  tree: z.array(z.object({
    path: z.string(),
    size: z.number().int().nonnegative().optional(),
    type: z.enum(["blob", "tree", "commit"]),
  })),
  truncated: z.boolean().optional(),
});

export class GitHubRepositoryBrowserError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function githubHeaders() {
  const headers = new Headers({
    Accept: "application/vnd.github+json",
    "User-Agent": "chen-yuan-personal-site",
    "X-GitHub-Api-Version": "2022-11-28",
  });
  if (process.env.GITHUB_TOKEN) headers.set("Authorization", `Bearer ${process.env.GITHUB_TOKEN}`);
  return headers;
}

async function githubFetch(pathname: string, init: RequestInit = {}) {
  const headers = githubHeaders();
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  const response = await fetch(`https://api.github.com${pathname}`, {
    ...init,
    headers,
    next: { revalidate: 600 },
  });
  if (response.status === 404) throw new GitHubRepositoryBrowserError("原始仓库或文件不存在。", 404);
  if (!response.ok) throw new GitHubRepositoryBrowserError("暂时无法读取 GitHub 原始仓库。", 502);
  return response;
}

async function resolvePublicRepository(slug: string) {
  const entry = await getOpenSourceEntry(slug);
  if (!entry) throw new GitHubRepositoryBrowserError("未找到已公开的开源仓库。", 404);
  const repository = repositorySchema.safeParse(entry.repository);
  if (!repository.success) throw new GitHubRepositoryBrowserError("公开仓库地址无效。", 500);
  return {
    // repositoryDefaultBranch 由 github-starred 同步管线写入公开投影（见
    // modules/github-starred/publish-to-sqlite.mjs）；存量投影行在回填前仍为
    // null，此时读取侧保留回源 GitHub 的兜底（getDefaultBranch）。
    defaultBranch: entry.repositoryDefaultBranch ?? null,
    repository: repository.data,
    repositoryUrl: entry.repositoryUrl,
  };
}

async function getDefaultBranch(repository: string) {
  const response = await githubFetch(`/repos/${repository}`);
  return repositoryMetadataSchema.parse(await response.json()).default_branch;
}

export async function getGitHubRepositoryTree(slug: string) {
  const { defaultBranch, repository, repositoryUrl } = await resolvePublicRepository(slug);
  const branch = defaultBranch ?? await getDefaultBranch(repository);
  const response = await githubFetch(`/repos/${repository}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  const result = repositoryTreeSchema.parse(await response.json());
  const entries: GitHubRepositoryTreeEntry[] = result.tree
    .flatMap((entry) => entry.type === "blob" || entry.type === "tree"
      ? [{ path: entry.path, size: entry.size, type: entry.type }]
      : [])
    .slice(0, MAX_TREE_ENTRIES);

  return {
    branch,
    entries,
    repository,
    repositoryUrl,
    truncated: Boolean(result.truncated) || result.tree.length > MAX_TREE_ENTRIES,
  };
}

export async function getGitHubRepositoryFile(slug: string, requestedPath: string) {
  const path = normalizeGitHubPath(requestedPath);
  if (!path) throw new GitHubRepositoryBrowserError("文件路径无效。", 400);

  const { defaultBranch, repository, repositoryUrl } = await resolvePublicRepository(slug);
  const branch = defaultBranch ?? await getDefaultBranch(repository);
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await githubFetch(`/repos/${repository}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`, {
    headers: { Accept: "application/vnd.github.raw" },
  });
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_FILE_BYTES) throw new GitHubRepositoryBrowserError("文件超过 512 KB，已改为仅提供 GitHub 原文件链接。", 413);

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_FILE_BYTES) throw new GitHubRepositoryBrowserError("文件超过 512 KB，已改为仅提供 GitHub 原文件链接。", 413);
  const binary = bytes.includes(0);

  return {
    binary,
    branch,
    content: binary ? null : new TextDecoder().decode(bytes),
    fileUrl: githubRepositoryFileUrl(repositoryUrl, branch, path),
    path,
    repository,
  };
}
