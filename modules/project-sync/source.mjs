import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { evidenceSnapshotSchema, projectCatalogSchema } from "./schema.mjs";

const execFileAsync = promisify(execFile);
const MAX_DOCUMENT_CHARACTERS = 24000;
const MAX_MEMORY_BLOCK_CHARACTERS = 18000;

export function canonicalJson(value) {
  const sort = (item) => {
    if (Array.isArray(item)) return item.map(sort);
    if (!item || typeof item !== "object") return item;
    return Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])]));
  };
  return JSON.stringify(sort(value));
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function assertPublicContentSafe(value) {
  const content = canonicalJson(value);
  const forbidden = [
    /\/Users\//u,
    /(?:^|["'\s])data\/sensitive\//u,
    /\.codex\/(?:sessions|memories)\//u,
    /\b(?:sb_secret_|sk-[A-Za-z0-9_-]{12,})/u,
  ];
  const match = forbidden.find((pattern) => pattern.test(content));
  if (match) throw new Error(`公开项目内容命中敏感内容规则：${match}`);
  return true;
}

function truncate(value, maximum = MAX_DOCUMENT_CHARACTERS) {
  return value.length <= maximum ? value : `${value.slice(0, maximum)}\n\n[内容已按同步上限截断]`;
}

async function git(root, args) {
  const { stdout } = await execFileAsync("git", ["-C", root, ...args], { maxBuffer: 8 * 1024 * 1024 });
  return stdout.trim();
}

export async function resolveProjectRoots(catalog, repoRoot, env = process.env) {
  const entries = projectCatalogSchema.parse(catalog);
  const workspaceRoot = env.PROJECT_WORKSPACE_ROOT
    ? path.resolve(env.PROJECT_WORKSPACE_ROOT)
    : path.dirname(repoRoot);
  return Promise.all(entries.map(async (entry) => ({
    ...entry,
    root: await realpath(path.resolve(workspaceRoot, entry.directory)),
  })));
}

function commitUrl(repo, hash) {
  return repo ? `${repo.replace(/\/$/u, "")}/commit/${hash}` : undefined;
}

async function collectGitEvidence(project) {
  const head = await git(project.root, ["rev-parse", "HEAD"]);
  const raw = await git(project.root, [
    "log",
    "-n",
    "100",
    "--date=iso-strict",
    "--pretty=format:%H%x1f%aI%x1f%s%x1e",
  ]);
  const commits = raw
    .split("\u001e")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [hash, occurredAt, subject] = row.split("\u001f");
      return {
        content: subject,
        id: `git:${hash}`,
        kind: "commit",
        label: subject,
        occurredAt,
        ...(commitUrl(project.repo, hash) ? { url: commitUrl(project.repo, hash) } : {}),
      };
    });
  return { commits, head };
}

async function collectDocumentEvidence(project, head) {
  const rows = [];
  for (const relativePath of project.documents) {
    const absolutePath = path.resolve(project.root, relativePath);
    if (!absolutePath.startsWith(`${project.root}${path.sep}`)) {
      throw new Error(`${project.id} 文档路径越过项目根目录：${relativePath}`);
    }
    try {
      const content = truncate(await readFile(absolutePath, "utf8"));
      let publicUrl;
      if (project.repo) {
        try {
          await git(project.root, ["cat-file", "-e", `${head}:${relativePath}`]);
          publicUrl = `${project.repo.replace(/\/$/u, "")}/blob/${head}/${relativePath}`;
        } catch {
          publicUrl = undefined;
        }
      }
      rows.push({
        content,
        id: `doc:${relativePath}`,
        kind: "document",
        label: relativePath,
        occurredAt: null,
        ...(publicUrl ? { url: publicUrl } : {}),
      });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return rows;
}

export function extractMemoryBlocks(markdown, projectRoots) {
  const blocks = markdown.split(/(?=^# Task Group:)/gmu);
  return blocks.filter((block) => projectRoots.some((root) => block.includes(`cwd=${root}`)));
}

async function collectCodexEvidence(project, env = process.env) {
  const memoryPath = env.CODEX_MEMORY_REGISTRY
    ? path.resolve(env.CODEX_MEMORY_REGISTRY)
    : path.join(os.homedir(), ".codex/memories/MEMORY.md");
  let markdown;
  try {
    markdown = await readFile(memoryPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const roots = project.memoryDirectories.map((directory) => path.join(path.dirname(project.root), directory));
  return extractMemoryBlocks(markdown, roots).map((block) => {
    const title = /^# Task Group:\s*(.+)$/mu.exec(block)?.[1]?.trim() ?? `${project.title} Codex 记录`;
    const updatedAt = [...block.matchAll(/updated_at=([^,\s)]+)/gu)].at(-1)?.[1] ?? null;
    const content = truncate(block, MAX_MEMORY_BLOCK_CHARACTERS);
    return {
      content,
      id: `codex:${sha256(title)}`,
      kind: "private-verification",
      label: title,
      occurredAt: updatedAt,
    };
  });
}

export async function collectProjectEvidence(project, env = process.env) {
  const [{ commits, head }, codex] = await Promise.all([
    collectGitEvidence(project),
    collectCodexEvidence(project, env),
  ]);
  const documents = await collectDocumentEvidence(project, head);
  const evidence = [...commits, ...documents, ...codex];
  const timestamps = evidence.map((item) => item.occurredAt).filter(Boolean).sort();
  const sourceObservedAt = timestamps.at(-1) ?? null;
  return evidenceSnapshotSchema.parse({
    evidence,
    projectId: project.id,
    sourceDigest: sha256(canonicalJson(evidence)),
    sourceObservedAt,
  });
}

export function projectSyncPaths(repoRoot, projectId) {
  const privateRoot = path.join(repoRoot, "data/sensitive/project-sync", projectId);
  const stateRoot = path.join(repoRoot, "var/project-sync", projectId);
  return {
    approved: path.join(privateRoot, "approved.json"),
    draft: path.join(privateRoot, "draft.json"),
    evidence: path.join(privateRoot, "evidence.json"),
    privateRoot,
    state: path.join(stateRoot, "state.json"),
    stateRoot,
  };
}

export async function readJson(pathname) {
  try {
    return JSON.parse(await readFile(pathname, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function writePrivateJson(pathname, value) {
  await mkdir(path.dirname(pathname), { recursive: true, mode: 0o700 });
  await writeFile(pathname, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}
