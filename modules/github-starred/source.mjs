import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const README_FILE = "README.md";
const REPOSITORY_FILE = "repository-structure.md";
const SNAPSHOT_FILE = "source.json";
const MANIFEST_FILES = ["package.json", "pyproject.toml", "Cargo.toml", "go.mod", "pom.xml", "Gemfile"];
const CHINESE_README_NAME = /^readme(?:[._-](?:zh(?:[._-]?cn)?|cn|chinese))?\.(?:md|mdx|rst|txt)$/iu;

const STARRED_REPOSITORIES_QUERY = `
  query StarredRepositories($after: String) {
    viewer {
      starredRepositories(first: 100, after: $after, orderBy: { field: STARRED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        edges {
          starredAt
          node {
            id
            name
            nameWithOwner
            url
            description
            isArchived
            isFork
            isPrivate
            stargazerCount
            updatedAt
            defaultBranchRef { name }
            primaryLanguage { name }
            owner { login }
            repositoryTopics(first: 20) { nodes { topic { name } } }
          }
        }
      }
    }
  }
`;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function repositoryDirectoryName(fullName) {
  return fullName.replace(/[^a-zA-Z0-9._-]+/gu, "--");
}

export function sourceFileForKind(kind) {
  return kind === "readme" ? README_FILE : REPOSITORY_FILE;
}

function truncateUtf8(value, maximumBytes) {
  if (Buffer.byteLength(value, "utf8") <= maximumBytes) return { truncated: false, value };
  let end = Math.min(value.length, maximumBytes);
  while (Buffer.byteLength(value.slice(0, end), "utf8") > maximumBytes) end -= 1;
  return { truncated: true, value: value.slice(0, end) };
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function compactRepository(node, starredAt) {
  return {
    defaultBranch: node.defaultBranchRef?.name ?? null,
    description: node.description ?? "",
    fullName: node.nameWithOwner,
    isArchived: Boolean(node.isArchived),
    isFork: Boolean(node.isFork),
    isPrivate: Boolean(node.isPrivate),
    language: node.primaryLanguage?.name ?? null,
    nodeId: node.id,
    owner: node.owner?.login ?? node.nameWithOwner.split("/")[0],
    repositoryUrl: node.url,
    starredAt: toIso(starredAt),
    stargazerCount: Number(node.stargazerCount ?? 0),
    topics: (node.repositoryTopics?.nodes ?? []).map((item) => item.topic.name),
    updatedAt: toIso(node.updatedAt),
  };
}

async function gh(args, { exec = execFileAsync } = {}) {
  const { stdout } = await exec("gh", args, { maxBuffer: 8 * 1024 * 1024 });
  return stdout;
}

async function ghJson(args, options) {
  return JSON.parse(await gh(args, options));
}

function isNotFound(error) {
  const body = `${error?.stdout ?? ""}\n${error?.stderr ?? ""}\n${error?.message ?? ""}`;
  return /(?:HTTP 404|Not Found|status 404)/iu.test(body);
}

export async function listStarredRepositories({ limit = Infinity, exec } = {}) {
  const repositories = [];
  let after = null;

  while (repositories.length < limit) {
    const stdout = await gh(
      [
        "api",
        "graphql",
        "-f",
        `query=${STARRED_REPOSITORIES_QUERY}`,
        "-f",
        `after=${after ?? ""}`,
      ],
      { exec },
    );
    const page = JSON.parse(stdout).data.viewer.starredRepositories;
    for (const edge of page.edges) {
      repositories.push(compactRepository(edge.node, edge.starredAt));
      if (repositories.length >= limit) break;
    }
    if (!page.pageInfo.hasNextPage || repositories.length >= limit) break;
    after = page.pageInfo.endCursor;
  }

  return repositories;
}

async function fetchReadme(repository, { exec } = {}) {
  try {
    const markdown = await gh(
      ["api", `repos/${repository.fullName}/readme`, "-H", "Accept: application/vnd.github.raw"],
      { exec },
    );
    return markdown;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw new Error(`读取 ${repository.fullName} README 失败：${error.message}`);
  }
}

function normaliseContents(items) {
  const rows = Array.isArray(items) ? items : [items];
  return rows
    .filter((item) => item && typeof item.name === "string")
    .map((item) => ({
      name: item.name,
      path: item.path,
      size: Number(item.size ?? 0),
      type: item.type,
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function isChineseMarkdown(markdown) {
  const characters = markdown.match(/[\u3400-\u9fff]/gu) ?? [];
  return characters.length >= 20;
}

function chineseReadmeCandidates(entries) {
  return entries
    .filter((entry) => entry.type === "file" && CHINESE_README_NAME.test(entry.name))
    .sort((left, right) => {
      const score = (entry) => (/zh[-_.]?cn/iu.test(entry.name) ? 0 : /(?:[_.-]cn|chinese)/iu.test(entry.name) ? 1 : 2);
      return score(left) - score(right) || left.path.localeCompare(right.path);
    });
}

async function fetchRawFile(repository, filePath, { exec } = {}) {
  try {
    return await gh(
      ["api", `repos/${repository.fullName}/contents/${filePath}`, "-H", "Accept: application/vnd.github.raw"],
      { exec },
    );
  } catch (error) {
    if (isNotFound(error)) return null;
    throw new Error(`读取 ${repository.fullName}/${filePath} 失败：${error.message}`);
  }
}

async function fetchOfficialChineseReadme(repository, { exec, maxBytes } = {}) {
  const refQuery = repository.defaultBranch ? `?ref=${encodeURIComponent(repository.defaultBranch)}` : "";
  const root = normaliseContents(await ghJson(["api", `repos/${repository.fullName}/contents${refQuery}`], { exec }));
  for (const candidate of chineseReadmeCandidates(root)) {
    const raw = await fetchRawFile(repository, candidate.path, { exec });
    if (raw === null || !isChineseMarkdown(raw)) continue;
    return { markdown: truncateUtf8(raw, maxBytes), path: candidate.path };
  }
  return null;
}

export function buildRepositoryStructureMarkdown(repository, rootEntries, manifests) {
  const lines = [
    `# ${repository.fullName}`,
    "",
    "_README 不存在；以下为仓库根目录与可识别入口文件的原始证据。_",
    "",
    "## Root structure",
    "",
    "```text",
    ...rootEntries.map((entry) => `${entry.type === "dir" ? "[dir]" : "[file]"} ${entry.path}`),
    "```",
  ];

  for (const [filePath, content] of Object.entries(manifests)) {
    if (!content) continue;
    lines.push("", `## ${filePath}`, "", "```text", content.trimEnd(), "```");
  }
  return lines.join("\n") + "\n";
}

async function fetchRepositoryStructure(repository, { exec, maxBytes } = {}) {
  const refQuery = repository.defaultBranch ? `?ref=${encodeURIComponent(repository.defaultBranch)}` : "";
  const root = normaliseContents(await ghJson(["api", `repos/${repository.fullName}/contents${refQuery}`], { exec }));
  const names = new Set(root.filter((item) => item.type === "file").map((item) => item.name));
  const manifests = {};

  for (const fileName of MANIFEST_FILES) {
    if (!names.has(fileName)) continue;
    const raw = await fetchRawFile(repository, fileName, { exec });
    if (raw !== null) manifests[fileName] = raw.slice(0, maxBytes);
  }

  return {
    manifests,
    markdown: buildRepositoryStructureMarkdown(repository, root, manifests),
    root,
  };
}

async function writeSnapshot(rawRoot, record) {
  const directory = path.join(rawRoot, repositoryDirectoryName(record.repository.fullName));
  const sourceFile = sourceFileForKind(record.sourceKind);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(path.join(directory, sourceFile), record.sourceMarkdown, { encoding: "utf8", mode: 0o600 });
  const readingFile = record.readingMarkdown && record.readingMarkdown !== record.sourceMarkdown
    ? `official-zh-${path.basename(record.readingSourcePath ?? "README.md")}`
    : null;
  if (readingFile) {
    await writeFile(path.join(directory, readingFile), record.readingMarkdown, { encoding: "utf8", mode: 0o600 });
  }
  await writeFile(
    path.join(directory, SNAPSHOT_FILE),
    JSON.stringify(
      {
        metadata: record.repository,
        schemaVersion: 1,
        sourceFetchedAt: record.sourceFetchedAt,
        sourceFile,
        readingFile,
        readingSourcePath: record.readingSourcePath,
        readingTruncated: record.readingTruncated,
        sourceKind: record.sourceKind,
        sourceLanguage: record.sourceLanguage,
        sourceSha256: record.sourceSha256,
        sourceStructure: record.sourceStructure,
        sourceTruncated: record.sourceTruncated,
      },
      null,
      2,
    ) + "\n",
    { encoding: "utf8", mode: 0o600 },
  );
  return directory;
}

export async function syncRepositorySource(repository, { exec, maxBytes = 1024 * 1024, rawRoot } = {}) {
  const readme = await fetchReadme(repository, { exec });
  const sourceFetchedAt = new Date().toISOString();
  const isReadme = readme !== null;
  const structure = isReadme ? null : await fetchRepositoryStructure(repository, { exec, maxBytes });
  const source = isReadme ? readme : structure.markdown;
  const truncatedSource = truncateUtf8(source, maxBytes);
  const sourceTruncated = isReadme && truncatedSource.truncated;
  const sourceMarkdown = truncatedSource.value;
  const sourceLanguage = isReadme && isChineseMarkdown(sourceMarkdown) ? "zh-CN" : "other";
  const officialChineseReadme = isReadme && sourceLanguage !== "zh-CN"
    ? await fetchOfficialChineseReadme(repository, { exec, maxBytes })
    : null;
  const readingMarkdown = sourceLanguage === "zh-CN" ? sourceMarkdown : officialChineseReadme?.markdown.value ?? null;
  const record = {
    readingMarkdown,
    readingSourcePath: sourceLanguage === "zh-CN" ? "README" : officialChineseReadme?.path ?? null,
    readingTruncated: sourceLanguage === "zh-CN" ? sourceTruncated : Boolean(officialChineseReadme?.markdown.truncated),
    repository,
    sourceFetchedAt,
    sourceKind: isReadme ? "readme" : "repository",
    sourceLanguage,
    sourceMarkdown,
    // 纯英文 README 且没有官方中文版本时，沿用旧的哈希，避免无意义地重跑既有翻译。
    // 一旦出现官方中文 README，就让它参与哈希，以淘汰此前的机器翻译结果。
    sourceSha256: sha256(readingMarkdown ? `${sourceMarkdown}\u0000${readingMarkdown}` : sourceMarkdown),
    sourceStructure: structure ? { manifests: structure.manifests, root: structure.root } : null,
    sourceTruncated,
  };
  if (rawRoot) await writeSnapshot(rawRoot, record);
  return record;
}

export function repositoryNeedsSourceRefresh(repository, existingRecord) {
  if (!existingRecord) return true;
  const existing = existingRecord.repository;
  return existing.updatedAt !== repository.updatedAt
    || existing.defaultBranch !== repository.defaultBranch
    || existing.repositoryUrl !== repository.repositoryUrl;
}

function withCurrentRepositoryMetadata(existingRecord, repository) {
  return {
    ...existingRecord,
    repository,
  };
}

export async function syncStarredRepositories({ concurrency = 15, exec, existingRecords = [], incremental = false, limit = Infinity, maxBytes, onRecord, only, rawRoot, repositories: suppliedRepositories } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("concurrency 必须是大于 0 的整数。");
  if (!rawRoot) throw new Error("rawRoot 是同步 Star 原始资料的必填目录。");

  const discovered = suppliedRepositories ?? await listStarredRepositories({ exec, limit: only ? Infinity : limit });
  const repositories = only ? discovered.filter((repository) => only.has(repository.fullName)).slice(0, limit) : discovered;
  const existingByNodeId = new Map(existingRecords.map((record) => [record.repository.nodeId, record]));
  const records = [];
  const changedRecords = [];
  let cursor = 0;
  let completed = 0;
  const worker = async () => {
    while (cursor < repositories.length) {
      const index = cursor;
      cursor += 1;
      const repository = repositories[index];
      const existing = existingByNodeId.get(repository.nodeId);
      const changed = !incremental || repositoryNeedsSourceRefresh(repository, existing);
      const record = changed
        ? await syncRepositorySource(repository, { exec, maxBytes, rawRoot })
        : withCurrentRepositoryMetadata(existing, repository);
      if (!changed) await writeSnapshot(rawRoot, record);
      records.push(record);
      if (changed) changedRecords.push(record);
      completed += 1;
      await onRecord?.(record, completed, repositories.length, { changed });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, repositories.length) }, worker));
  const sortedRecords = records.sort((left, right) => left.repository.fullName.localeCompare(right.repository.fullName));
  Object.defineProperty(sortedRecords, "changedRecords", {
    enumerable: false,
    value: changedRecords.sort((left, right) => left.repository.fullName.localeCompare(right.repository.fullName)),
  });
  return sortedRecords;
}

export async function readLocalSourceRecords(rawRoot) {
  const directories = await readdir(rawRoot, { withFileTypes: true });
  const records = [];
  for (const directory of directories) {
    if (!directory.isDirectory()) continue;
    const folder = path.join(rawRoot, directory.name);
    const snapshot = JSON.parse(await readFile(path.join(folder, SNAPSHOT_FILE), "utf8"));
    const sourceMarkdown = await readFile(path.join(folder, snapshot.sourceFile), "utf8");
    const readingMarkdown = snapshot.readingFile
      ? await readFile(path.join(folder, snapshot.readingFile), "utf8")
      : snapshot.sourceLanguage === "zh-CN"
        ? sourceMarkdown
        : null;
    records.push({
      repository: snapshot.metadata,
      sourceFetchedAt: snapshot.sourceFetchedAt,
      readingMarkdown,
      readingSourcePath: snapshot.readingSourcePath ?? null,
      readingTruncated: Boolean(snapshot.readingTruncated),
      sourceKind: snapshot.sourceKind,
      sourceLanguage: snapshot.sourceLanguage ?? "other",
      sourceMarkdown,
      sourceSha256: snapshot.sourceSha256,
      sourceStructure: snapshot.sourceStructure ?? null,
      sourceTruncated: Boolean(snapshot.sourceTruncated),
    });
  }
  return records.sort((left, right) => left.repository.fullName.localeCompare(right.repository.fullName));
}
