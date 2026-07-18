#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { frontmatter, inlineText } from "./yuque-to-okf.mjs";
import { repositoryConceptId } from "./lib/github-inventory.mjs";
import {
  assertRegularFile,
  resolveInside,
  sha256,
  writeUtf8Exclusive as writeUtf8,
} from "./lib/private-file-integrity.mjs";

function markdownText(value) {
  return String(value).replace(/([\\[\]])/gu, "\\$1").replace(/\s+/gu, " ").trim();
}

function indexDocument(title, sections) {
  const lines = [`# ${title}`, ""];
  for (const section of sections) {
    if (section.entries.length === 0) continue;
    lines.push(`# ${section.title}`, "");
    for (const entry of section.entries) {
      lines.push(`* [${markdownText(entry.title)}](${entry.href}) - ${markdownText(entry.description)}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function concept(fields, title, body, provenance) {
  return `${frontmatter(fields)}# ${title}\n\n> ${provenance}\n\n${String(body).trim()}\n`;
}

async function readRepositoryObject(rawRoot, object) {
  if (!/^\d+$/u.test(object?.source_id ?? "") || !/^[a-f0-9]{64}$/u.test(object?.sha256 ?? "")) {
    throw new Error("github-manifest-object-invalid");
  }
  const file = resolveInside(rawRoot, object.path, "repository-object");
  await assertRegularFile(file, rawRoot, "repository-object");
  const bytes = await readFile(file);
  if (sha256(bytes) !== object.sha256) throw new Error(`github-object-hash-mismatch:${object.source_id}`);
  const payload = JSON.parse(bytes.toString("utf8"));
  if (payload.schema_version !== "1.0.0" || payload.kind !== "repository" || payload.source_id !== object.source_id) {
    throw new Error(`github-object-payload-invalid:${object.source_id}`);
  }
  return payload.record;
}

async function readReadme(rawRoot, record) {
  if (record.readme?.status !== "available") return null;
  const metadata = record.readme;
  if (!/^[a-f0-9]{64}$/u.test(metadata.sha256 ?? "")) throw new Error(`github-readme-sha-invalid:${record.sourceId}`);
  const file = resolveInside(rawRoot, metadata.path, "readme-blob");
  await assertRegularFile(file, rawRoot, "readme-blob");
  const bytes = await readFile(file);
  if (sha256(bytes) !== metadata.sha256 || bytes.length !== metadata.size) {
    throw new Error(`github-readme-integrity-failed:${record.sourceId}`);
  }
  return bytes.toString("utf8").replaceAll("\u0000", "");
}

function uniqueTags(values) {
  return [...new Set(values.map((value) => inlineText(value, "", 60)).filter(Boolean))];
}

function projectRole(record) {
  if (record.relationships.includes("owned")) {
    return record.repository.fork ? "forked" : "owned-original-unreviewed";
  }
  if (record.relationships.includes("starred") && record.relationships.includes("watched")) return "reference-and-watched";
  if (record.relationships.includes("starred")) return "reference";
  if (record.relationships.includes("watched")) return "watched";
  return "inactive-reference";
}

function reviewStatus(record) {
  if (!record.active || record.repository.private || record.relationships.includes("owned")) return "needs-review";
  return "unreviewed";
}

function repositoryDescription(record) {
  return inlineText(record.repository.description, `${record.repository.full_name} 的 GitHub 仓库元数据。`);
}

function repositoryEntry(item) {
  const qualifiers = [item.record.repository.language, item.role, item.record.active ? null : "inactive"].filter(Boolean);
  return {
    title: item.record.repository.full_name,
    href: repositoryConceptId(item.record.sourceId),
    description: `${repositoryDescription(item.record)}（${qualifiers.join(" / ")}）`,
  };
}

function sortEntries(entries) {
  return entries.sort((left, right) => left.title.localeCompare(right.title, "en", { sensitivity: "base" }));
}

function countBy(items, selector) {
  const counts = {};
  for (const item of items) {
    const key = selector(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function repositoryBody(item, readme) {
  const { record } = item;
  const repository = record.repository;
  const relationText = record.relationships.length > 0 ? record.relationships.join("、") : "当前无活动关系";
  const lines = [
    repositoryDescription(record),
    "",
    "## Repository Snapshot",
    "",
    `- GitHub 仓库：[${repository.full_name}](${repository.html_url})`,
    `- 当前关系：${relationText}`,
    `- 项目角色：${item.role}`,
    `- 可见性：${repository.visibility}`,
    `- Fork：${repository.fork ? "是" : "否"}`,
    `- Archived：${repository.archived ? "是" : "否"}`,
    `- 默认分支：${repository.default_branch ?? "未知"}`,
    `- 主要语言：${repository.language ?? "未知"}`,
    `- Stars / Forks：${repository.stargazers_count} / ${repository.forks_count}`,
    `- 首次纳入：${record.firstSeenAt ?? "未知"}`,
    `- 最近来源变化：${record.lastChangedAt ?? "未知"}`,
  ];
  if (record.starredAt) lines.push(`- Star 时间：${record.starredAt}`);
  if (!record.active) {
    lines.push(`- Inactive since：${record.inactiveSince ?? "未知"}`);
    lines.push(`- 上一次关系：${record.previousRelationships.join("、") || "未知"}`);
    lines.push(`- 远端状态：${record.remoteStatus}`);
  }
  if (repository.topics.length > 0) lines.push(`- Topics：${repository.topics.join("、")}`);
  lines.push(
    "",
    "## Interpretation Boundary",
    "",
    record.relationships.includes("owned") && !repository.fork
      ? "该仓库属于当前账号且不是 GitHub Fork，但这仍不足以自动判断它是完全原创、改编、迁移还是练习项目；进入公开作品集前需要人工分类。"
      : repository.fork
        ? "GitHub 将该仓库标记为 Fork；本 Bundle 不把仓库所有关系解释为原创作者身份。"
        : "该仓库作为关注、参考或学习资料收录；Star 或 Watch 不代表作者身份。",
  );
  if (readme !== null) {
    lines.push(
      "",
      "## README Snapshot",
      "",
      `> 来源文件：${record.readme.name ?? "README"}；SHA-256：\`${record.readme.sha256}\`。这是同步时的证据快照。`,
      "",
      readme,
    );
  }
  return lines.join("\n");
}

export async function generateGithubBundle({ config, rawRoot, stagingRoot, manifest, manifestBytes }) {
  if (config.okf_version !== "0.1") throw new Error("unsupported-okf-version");
  if (manifest.schema_version !== "1.0.0" || manifest.source_system !== "github") {
    throw new Error("github-manifest-schema-unsupported");
  }
  if (manifest.complete !== true) throw new Error("github-manifest-incomplete");
  const manifestSha = sha256(manifestBytes);
  const seenIds = new Set();
  const items = [];
  for (const object of [...manifest.objects].sort((left, right) => left.source_id.localeCompare(right.source_id, "en", { numeric: true }))) {
    if (seenIds.has(object.source_id)) throw new Error(`github-source-id-duplicate:${object.source_id}`);
    seenIds.add(object.source_id);
    const record = await readRepositoryObject(rawRoot, object);
    const role = projectRole(record);
    items.push({ object, record, role, conceptId: repositoryConceptId(record.sourceId) });
  }

  for (const item of items) {
    const { object, record, role } = item;
    const repository = record.repository;
    const readme = await readReadme(rawRoot, record);
    const title = repository.full_name;
    const description = repositoryDescription(record);
    await writeUtf8(stagingRoot, item.conceptId.slice(1), concept({
      type: "GitHub Repository",
      title,
      description,
      resource: repository.html_url,
      tags: uniqueTags([
        "github",
        "repository",
        ...record.relationships,
        repository.fork ? "fork" : "original",
        repository.language,
        ...repository.topics,
      ]),
      timestamp: repository.updated_at ?? manifest.snapshot_at,
      source_system: "github",
      source_kind: "repository",
      source_id: record.sourceId,
      source_object: object.path,
      source_sha256: object.sha256,
      raw_manifest_sha256: manifestSha,
      visibility: "private",
      source_visibility: repository.visibility,
      review_status: reviewStatus(record),
      curation_status: record.active ? "active" : "inactive",
      project_role: role,
      github_relationships: record.relationships,
      previous_github_relationships: record.previousRelationships.length > 0 ? record.previousRelationships : undefined,
      repository_owner: repository.owner.login,
      repository_name: repository.name,
      repository_full_name: repository.full_name,
      repository_private: repository.private,
      repository_fork: repository.fork,
      repository_archived: repository.archived,
      repository_active: record.active,
      remote_status: record.remoteStatus,
      primary_language: repository.language ?? undefined,
      starred_at: record.starredAt ?? undefined,
      first_seen_at: record.firstSeenAt ?? undefined,
      last_changed_at: record.lastChangedAt ?? undefined,
      inactive_since: record.inactiveSince ?? undefined,
      readme_sha256: record.readme?.status === "available" ? record.readme.sha256 : undefined,
      readme_source_object: record.readme?.status === "available" ? record.readme.path : undefined,
    }, title, repositoryBody(item, readme), "由 GitHub Raw 仓库对象确定性生成；关系与 README 均来自同步快照。"));
  }

  const activeItems = items.filter((item) => item.record.active);
  const inactiveItems = items.filter((item) => !item.record.active);
  const ownedItems = activeItems.filter((item) => item.record.relationships.includes("owned"));
  const starredItems = activeItems.filter((item) => item.record.relationships.includes("starred"));
  const watchedItems = activeItems.filter((item) => item.record.relationships.includes("watched"));
  const originals = ownedItems.filter((item) => !item.record.repository.fork);
  const forks = ownedItems.filter((item) => item.record.repository.fork);
  const archivedItems = activeItems.filter((item) => item.record.repository.archived);
  const toEntries = (values) => sortEntries(values.map(repositoryEntry));

  await writeUtf8(stagingRoot, "github/repositories/index.md", indexDocument("GitHub 仓库总目录", [
    { title: "Active Repositories", entries: toEntries(activeItems) },
    { title: "Inactive Repositories", entries: toEntries(inactiveItems) },
  ]));
  await writeUtf8(stagingRoot, "github/owned/index.md", indexDocument("GitHub 自有仓库", [
    { title: "Owned Originals — 待人工确认项目角色", entries: toEntries(originals) },
    { title: "Owned Forks", entries: toEntries(forks) },
  ]));
  await writeUtf8(stagingRoot, "github/starred/index.md", indexDocument("GitHub Starred 仓库", [
    { title: "Starred", entries: toEntries(starredItems) },
  ]));
  await writeUtf8(stagingRoot, "github/watched/index.md", indexDocument("GitHub Watched 仓库", [
    { title: "Watched", entries: toEntries(watchedItems) },
  ]));
  await writeUtf8(stagingRoot, "github/forks/index.md", indexDocument("GitHub Fork 仓库", [
    { title: "Owned Forks", entries: toEntries(forks) },
  ]));
  await writeUtf8(stagingRoot, "github/inactive/index.md", indexDocument("GitHub 非活动历史仓库", [
    { title: "No Longer Owned, Starred, or Watched", entries: toEntries(inactiveItems) },
  ]));
  await writeUtf8(stagingRoot, "github/archived/index.md", indexDocument("GitHub Archived 仓库", [
    { title: "Archived at GitHub", entries: toEntries(archivedItems) },
  ]));
  await writeUtf8(stagingRoot, "github/review/index.md", indexDocument("GitHub 项目人工复核队列", [
    { title: "Owned Originals — Built / Adapted / Translated / Learning 待确认", entries: toEntries(originals) },
    { title: "Private Repositories — 公开前必须复核", entries: toEntries(activeItems.filter((item) => item.record.repository.private)) },
    { title: "Inactive Relationships", entries: toEntries(inactiveItems) },
  ]));

  const byLanguage = new Map();
  for (const item of activeItems) {
    const language = item.record.repository.language ?? "Unknown";
    if (!byLanguage.has(language)) byLanguage.set(language, []);
    byLanguage.get(language).push(item);
  }
  const languageDirectory = [];
  for (const [language, languageItems] of [...byLanguage.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const directory = sha256(language).slice(0, 12);
    await writeUtf8(stagingRoot, `github/languages/${directory}/index.md`, indexDocument(`GitHub Language: ${language}`, [
      { title: "Repositories", entries: toEntries(languageItems) },
    ]));
    languageDirectory.push({
      title: language,
      href: `${directory}/`,
      description: `${languageItems.length} 个活动仓库。`,
    });
  }
  await writeUtf8(stagingRoot, "github/languages/index.md", indexDocument("GitHub 仓库语言目录", [
    { title: "Languages", entries: languageDirectory },
  ]));

  const roleCounts = countBy(items, (item) => item.role);
  const languageCounts = countBy(activeItems, (item) => item.record.repository.language ?? "Unknown");
  const report = {
    schema_version: "1.0.0",
    okf_version: config.okf_version,
    raw_manifest_sha256: manifestSha,
    snapshot_timestamp: manifest.snapshot_at,
    policy: {
      stable_source_paths: true,
      repository_identity: "github-numeric-repository-id",
      collection_deduplication: "one-concept-per-repository-id",
      relationship_history_retained: true,
      inactive_sources_retained: true,
      authorship_inference: "never-from-ownership-star-or-watch-alone",
      owned_original_review: "human-review-required",
      raw_objects_immutable: true,
    },
    counts: {
      repositories: items.length,
      active: activeItems.length,
      inactive: inactiveItems.length,
      owned: ownedItems.length,
      owned_originals: originals.length,
      owned_forks: forks.length,
      starred: starredItems.length,
      watched: watchedItems.length,
      private: activeItems.filter((item) => item.record.repository.private).length,
      archived: archivedItems.length,
      readmes: activeItems.filter((item) => item.record.readme?.status === "available").length,
      roles: roleCounts,
      languages: languageCounts,
    },
    items: items.map((item) => ({
      concept_id: item.conceptId,
      source_id: item.record.sourceId,
      full_name: item.record.repository.full_name,
      active: item.record.active,
      relationships: item.record.relationships,
      previous_relationships: item.record.previousRelationships,
      project_role: item.role,
      review_status: reviewStatus(item.record),
      private: item.record.repository.private,
      fork: item.record.repository.fork,
      archived: item.record.repository.archived,
      language: item.record.repository.language,
      readme_status: item.record.readme?.status ?? "not-collected",
      readme_source_object: item.record.readme?.status === "available" ? item.record.readme.path : null,
      first_seen_at: item.record.firstSeenAt,
      last_changed_at: item.record.lastChangedAt,
      inactive_since: item.record.inactiveSince,
      remote_status: item.record.remoteStatus,
    })),
  };
  await writeUtf8(stagingRoot, "github-curation.json", `${JSON.stringify(report, null, 2)}\n`);

  const reportBody = [
    "这份报告描述 GitHub Raw 清单如何转换为当前 OKF Concepts，并明确自动整理不能替代的项目归属判断。",
    "",
    "## Outcome",
    "",
    `- 去重后的仓库：${items.length}（活动 ${activeItems.length}，历史 inactive ${inactiveItems.length}）`,
    `- 自有仓库：${ownedItems.length}（非 Fork ${originals.length}，Fork ${forks.length}）`,
    `- Starred / Watched：${starredItems.length} / ${watchedItems.length}`,
    `- README 证据快照：${report.counts.readmes}`,
    `- 私有 / Archived：${report.counts.private} / ${report.counts.archived}`,
    "",
    "## Incremental Update Policy",
    "",
    "- Concept ID 使用 GitHub 数字仓库 ID，仓库改名或转移后路径仍保持稳定。",
    "- Owned、Starred、Watched 关系合并到同一 Concept，不复制仓库条目。",
    "- 后续同步比较元数据和关系；新增、更新、取消关系和重新激活都会进入 Raw manifest 的 changes。",
    "- 失去全部活动关系的仓库保留为 inactive 历史，不从知识库静默删除。",
    "- 自有非 Fork 只说明账号关系，不自动断言 Built、Adapted、Translated 或完全原创；公开前进入人工复核。",
  ].join("\n");
  await writeUtf8(stagingRoot, "github/curation-report.md", concept({
    type: "Curation Report",
    title: "GitHub OKF 整理报告",
    description: "GitHub 自有、Starred、Watched 仓库的去重、关系和增量更新摘要。",
    tags: ["github", "okf", "curation", "report"],
    timestamp: manifest.snapshot_at,
    source_system: "github",
    raw_manifest_sha256: manifestSha,
    visibility: "private",
    review_status: "curated",
  }, "GitHub OKF 整理报告", reportBody, "由确定性 GitHub 整理规则生成；逐条明细见 Bundle 根目录 github-curation.json。"));

  await writeUtf8(stagingRoot, "github/index.md", indexDocument("GitHub 项目知识", [{
    title: "Collections",
    entries: [
      { title: "全部仓库", href: "repositories/", description: `${items.length} 个稳定仓库 Concepts。` },
      { title: "自有仓库", href: "owned/", description: `${ownedItems.length} 个；原始项目与 Fork 分层。` },
      { title: "Starred", href: "starred/", description: `${starredItems.length} 个关注或参考项目。` },
      { title: "Watched", href: "watched/", description: `${watchedItems.length} 个订阅项目。` },
      { title: "语言目录", href: "languages/", description: `${byLanguage.size} 个语言分组。` },
      { title: "Forks", href: "forks/", description: `${forks.length} 个账号 Fork。` },
      { title: "Archived", href: "archived/", description: `${archivedItems.length} 个 GitHub Archived 仓库。` },
      { title: "Inactive History", href: "inactive/", description: `${inactiveItems.length} 个已失去活动关系的历史仓库。` },
      { title: "人工复核", href: "review/", description: "项目角色、私有数据和关系变化复核入口。" },
      { title: "整理报告", href: "curation-report.md", description: "自动整理边界和增量更新策略。" },
    ],
  }]));

  const logDate = String(manifest.snapshot_at).slice(0, 10);
  await writeUtf8(stagingRoot, "github/log.md", `# GitHub Bundle Update Log\n\n## ${logDate}\n\n* **Snapshot**: Generated from GitHub Raw manifest \`${manifestSha}\`.\n* **Inventory**: Preserved ${items.length} stable repository identities; ${activeItems.length} active and ${inactiveItems.length} inactive.\n* **Relations**: Owned ${ownedItems.length}, starred ${starredItems.length}, watched ${watchedItems.length}; multi-relation repositories are represented once.\n* **Evidence**: Included ${report.counts.readmes} README snapshots for eligible owned originals.\n`);

  return {
    manifest_sha256: manifestSha,
    snapshot_timestamp: manifest.snapshot_at,
    repositories: items.length,
    active: activeItems.length,
    inactive: inactiveItems.length,
    owned: ownedItems.length,
    owned_originals: originals.length,
    owned_forks: forks.length,
    starred: starredItems.length,
    watched: watchedItems.length,
    readmes: report.counts.readmes,
    concepts: items.length + 1,
  };
}
