#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { frontmatter, inlineText } from "./yuque-to-okf.mjs";
import { historyConceptId, renderCodexMemoryRow } from "./lib/agent-history.mjs";
import {
  assertRegularFile,
  resolveInside,
  sha256,
  writeUtf8Exclusive as writeUtf8,
} from "./lib/private-file-integrity.mjs";

const UUID_GLOBAL_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu;

function markdownText(value) {
  return String(value).replace(/([\\[\]])/gu, "\\$1").replace(/\s+/gu, " ").trim();
}

function cleanBody(value) {
  return String(value ?? "").replaceAll("\u0000", "").trim();
}

function concept(fields, title, body, provenance) {
  return `${frontmatter(fields)}# ${title}\n\n> ${provenance}\n\n${cleanBody(body) || "_没有可显示的文本投影；完整内容仍保留在 Raw。_"}\n`;
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

function platformLabel(platform) {
  return platform === "codex" ? "Codex" : "Claude Code";
}

function sortEntries(entries) {
  return entries.sort((left, right) => left.title.localeCompare(right.title, "zh-Hans-CN", { numeric: true, sensitivity: "base" }));
}

async function readRawBytes(rawRoot, object) {
  const file = resolveInside(rawRoot, object.raw.path, "raw-object");
  await assertRegularFile(file, rawRoot, "raw-object");
  const bytes = await readFile(file);
  if (bytes.length !== object.raw.size || sha256(bytes) !== object.raw.sha256) {
    throw new Error(`agent-history-raw-integrity-failed:${object.platform}:${object.sourceId}`);
  }
  return bytes;
}

async function readProjection(rawRoot, object) {
  if (!object.projection) throw new Error(`agent-history-projection-missing:${object.platform}:${object.sourceId}`);
  const file = resolveInside(rawRoot, object.projection.path, "projection");
  await assertRegularFile(file, rawRoot, "projection");
  const bytes = await readFile(file);
  if (bytes.length !== object.projection.size || sha256(bytes) !== object.projection.sha256) {
    throw new Error(`agent-history-projection-integrity-failed:${object.platform}:${object.sourceId}`);
  }
  const projection = JSON.parse(bytes.toString("utf8"));
  if (projection.schema_version !== "1.0.0" || projection.platform !== object.platform || projection.sourceId !== object.sourceId) {
    throw new Error(`agent-history-projection-identity-failed:${object.platform}:${object.sourceId}`);
  }
  return projection;
}

function conversationBody(object, projection, conceptBySession) {
  const lines = [
    projection.summary ? inlineText(projection.summary, "", 500) : `${platformLabel(object.platform)} 会话的可读消息投影。`,
    "",
    "## Session Snapshot",
    "",
    `- 平台：${platformLabel(object.platform)}`,
    `- 会话 ID：\`${object.sourceId}\``,
    `- 来源状态：${object.sourceState}${object.active ? "" : " / inactive"}`,
    `- 工作目录：${projection.cwd ? `\`${projection.cwd}\`` : "未知"}`,
    `- Git 分支：${projection.gitBranch ?? "未知"}`,
    `- 模型：${projection.model ?? projection.modelProvider ?? "未知"}`,
    `- 时间范围：${projection.createdAt ?? "未知"} → ${projection.updatedAt ?? "未知"}`,
    `- 可读消息：${projection.counts.messages}（用户 ${projection.counts.user} / 助手 ${projection.counts.assistant}）`,
    `- Raw SHA-256：\`${object.raw.sha256}\``,
  ];
  if (projection.parentSessionId && conceptBySession.has(`${object.platform}:${projection.parentSessionId}`)) {
    lines.push(`- 父会话：[${projection.parentSessionId}](${conceptBySession.get(`${object.platform}:${projection.parentSessionId}`)})`);
  }
  if (!object.active) lines.push(`- Inactive since：${object.inactiveSince ?? "未知"}`);
  if (projection.summary) {
    lines.push("", "## Compaction Summary", "", cleanBody(projection.summary));
  }
  lines.push("", "# Conversation", "");
  if (projection.messages.length === 0) {
    lines.push("_当前投影没有用户或助手文本消息；工具事件与完整 JSONL 仍在 Raw。_", "");
  }
  for (const message of projection.messages) {
    const role = message.role === "user" ? "User" : "Assistant";
    lines.push(`## ${role} · ${message.timestamp ?? `Message ${message.index}`}`, "", cleanBody(message.text), "");
  }
  return lines.join("\n");
}

function memoryBody(object, rawText, conceptBySession) {
  const related = [...new Set([...rawText.matchAll(UUID_GLOBAL_PATTERN)].map((match) => match[0].toLowerCase()))]
    .flatMap((sessionId) => ["codex", "claude-code"]
      .map((platform) => ({ platform, conceptId: conceptBySession.get(`${platform}:${sessionId}`), sessionId }))
      .filter((entry) => entry.conceptId));
  const lines = [
    `这是 ${platformLabel(object.platform)} 的持久记忆或上下文文件，来源路径为 \`${object.sourcePath}\`。`,
    "",
    "## Memory Snapshot",
    "",
    `- 来源状态：${object.sourceState}${object.active ? "" : " / inactive"}`,
    `- Raw SHA-256：\`${object.raw.sha256}\``,
    `- 首次纳入：${object.firstSeenAt ?? "未知"}`,
    `- 最近变化：${object.lastChangedAt ?? "未知"}`,
  ];
  if (related.length > 0) {
    lines.push("", "## Related Conversations", "");
    for (const relation of related) {
      lines.push(`* [${platformLabel(relation.platform)} ${relation.sessionId}](${relation.conceptId})`);
    }
  }
  const sourceMemory = object.metadata?.format === "codex-memory-stage1-json"
    ? renderCodexMemoryRow(rawText)
    : rawText;
  lines.push("", "# Source Memory", "", sourceMemory);
  return lines.join("\n");
}

function promptHistoryBody(object, projection) {
  const lines = [
    "Claude Code 全局提示历史是项目会话之外的补充索引；同一提示可能同时出现在具体会话 Concept 中。",
    "",
    "## Snapshot",
    "",
    `- 条目：${projection.counts.messages}`,
    `- 时间范围：${projection.createdAt ?? "未知"} → ${projection.updatedAt ?? "未知"}`,
    `- Raw SHA-256：\`${object.raw.sha256}\``,
    "",
    "# Prompts",
    "",
  ];
  for (const message of projection.messages) {
    lines.push(`## ${message.timestamp ?? `Prompt ${message.index}`}`, "", cleanBody(message.text), "");
  }
  return lines.join("\n");
}

function conceptEntry(item) {
  return {
    title: item.title,
    href: item.conceptId,
    description: `${item.description}${item.object.active ? "" : "（inactive）"}`,
  };
}

function monthFor(item) {
  const timestamp = item.projection?.createdAt ?? item.object.metadata?.createdAt;
  return /^\d{4}-\d{2}/u.test(timestamp ?? "") ? timestamp.slice(0, 7) : "unknown";
}

function projectFor(item) {
  return item.projection?.cwd ?? item.object.metadata?.cwd ?? "Unknown project";
}

export async function generateAgentHistoryBundle({ config, rawRoot, stagingRoot, manifest, manifestBytes }) {
  if (config.okf_version !== "0.1") throw new Error("unsupported-okf-version");
  if (manifest.schema_version !== "1.0.0" || manifest.source_system !== "agent-history") {
    throw new Error("agent-history-manifest-schema-unsupported");
  }
  if (manifest.complete !== true) throw new Error("agent-history-manifest-incomplete");
  const manifestSha = sha256(manifestBytes);
  const conceptObjects = manifest.objects.filter((object) => ["conversation", "memory", "prompt-history"].includes(object.kind));
  const conceptBySession = new Map(manifest.objects
    .filter((object) => object.kind === "conversation")
    .map((object) => [`${object.platform}:${object.sourceId}`, historyConceptId(object)]));
  const items = [];

  for (const object of conceptObjects.sort((left, right) => `${left.platform}:${left.kind}:${left.sourceId}`.localeCompare(`${right.platform}:${right.kind}:${right.sourceId}`))) {
    const conceptId = historyConceptId(object);
    if (object.kind === "conversation") {
      const projection = await readProjection(rawRoot, object);
      const title = inlineText(projection.title, `${platformLabel(object.platform)} 会话 ${object.sourceId}`, 160);
      const description = `${platformLabel(object.platform)} 会话，包含 ${projection.counts.messages} 条可读用户/助手消息。`;
      await writeUtf8(stagingRoot, conceptId.slice(1), concept({
        type: "Agent Conversation",
        title,
        description,
        tags: ["agent-history", object.platform, "conversation", object.sourceState, object.active ? "active" : "inactive"],
        timestamp: projection.updatedAt ?? manifest.snapshot_at,
        source_system: object.platform,
        source_kind: "conversation",
        source_id: object.sourceId,
        source_path: object.sourcePath,
        source_object: object.raw.path,
        source_sha256: object.raw.sha256,
        projection_object: object.projection.path,
        projection_sha256: object.projection.sha256,
        raw_manifest_sha256: manifestSha,
        visibility: "private",
        review_status: "unreviewed",
        curation_status: object.active ? "active" : "inactive",
        content_scope: "user-assistant-readable-projection",
        raw_complete: true,
        platform: object.platform,
        source_state: object.sourceState,
        cwd: projection.cwd ?? undefined,
        parent_session_id: projection.parentSessionId ?? undefined,
        message_count: projection.counts.messages,
        first_seen_at: object.firstSeenAt,
        last_changed_at: object.lastChangedAt,
        inactive_since: object.inactiveSince ?? undefined,
      }, title, conversationBody(object, projection, conceptBySession), "由完整 Raw 会话生成可读投影；系统、开发者、推理和工具事件只保留在 Raw。"));
      items.push({ object, projection, conceptId, title, description });
    } else if (object.kind === "memory") {
      const bytes = await readRawBytes(rawRoot, object);
      const rawText = bytes.toString("utf8").replaceAll("\u0000", "");
      const title = inlineText(object.title, `${platformLabel(object.platform)} Memory ${object.sourceId}`, 160);
      const description = `${platformLabel(object.platform)} 持久记忆或上下文文件：${object.sourcePath}。`;
      await writeUtf8(stagingRoot, conceptId.slice(1), concept({
        type: "Agent Memory",
        title,
        description,
        tags: ["agent-history", object.platform, "memory", object.sourceState, object.active ? "active" : "inactive"],
        timestamp: object.metadata?.updatedAt ?? object.lastChangedAt ?? manifest.snapshot_at,
        source_system: object.platform,
        source_kind: "memory",
        source_id: object.sourceId,
        source_path: object.sourcePath,
        source_object: object.raw.path,
        source_sha256: object.raw.sha256,
        raw_manifest_sha256: manifestSha,
        visibility: "private",
        review_status: "unreviewed",
        curation_status: object.active ? "active" : "inactive",
        raw_complete: true,
        platform: object.platform,
        source_state: object.sourceState,
        first_seen_at: object.firstSeenAt,
        last_changed_at: object.lastChangedAt,
        inactive_since: object.inactiveSince ?? undefined,
      }, title, memoryBody(object, rawText, conceptBySession), "由持久记忆 Raw 文件原文生成；未自动改写或合并。"));
      items.push({ object, projection: null, conceptId, title, description });
    } else {
      const projection = await readProjection(rawRoot, object);
      const title = "Claude Code 全局提示历史";
      const description = `Claude Code 全局提示历史，共 ${projection.counts.messages} 条文本提示。`;
      await writeUtf8(stagingRoot, conceptId.slice(1), concept({
        type: "Agent Prompt History",
        title,
        description,
        tags: ["agent-history", "claude-code", "prompt-history"],
        timestamp: projection.updatedAt ?? manifest.snapshot_at,
        source_system: "claude-code",
        source_kind: "prompt-history",
        source_id: object.sourceId,
        source_path: object.sourcePath,
        source_object: object.raw.path,
        source_sha256: object.raw.sha256,
        projection_object: object.projection.path,
        projection_sha256: object.projection.sha256,
        raw_manifest_sha256: manifestSha,
        visibility: "private",
        review_status: "unreviewed",
        curation_status: object.active ? "active" : "inactive",
        content_scope: "user-readable-projection",
        raw_complete: true,
        platform: object.platform,
        message_count: projection.counts.messages,
      }, title, promptHistoryBody(object, projection), "由 Claude Code 全局 history.jsonl 生成；具体项目对话仍以会话 Concepts 为准。"));
      items.push({ object, projection, conceptId, title, description });
    }
  }

  for (const platform of ["codex", "claude-code"]) {
    const label = platformLabel(platform);
    const conversations = items.filter((item) => item.object.platform === platform && item.object.kind === "conversation");
    const memories = items.filter((item) => item.object.platform === platform && item.object.kind === "memory");
    const promptHistory = items.filter((item) => item.object.platform === platform && item.object.kind === "prompt-history");
    const byMonth = new Map();
    for (const item of conversations) {
      const month = monthFor(item);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month).push(item);
    }
    const monthEntries = [];
    for (const [month, monthItems] of [...byMonth.entries()].sort(([left], [right]) => right.localeCompare(left))) {
      await writeUtf8(stagingRoot, `agent-history/${platform}/conversations/${month}/index.md`, indexDocument(`${label} Conversations · ${month}`, [{
        title: "Conversations",
        entries: sortEntries(monthItems.map(conceptEntry)),
      }]));
      monthEntries.push({ title: month, href: `${month}/`, description: `${monthItems.length} 个会话。` });
    }
    await writeUtf8(stagingRoot, `agent-history/${platform}/conversations/index.md`, indexDocument(`${label} 会话历史`, [{
      title: "Months",
      entries: monthEntries,
    }]));
    await writeUtf8(stagingRoot, `agent-history/${platform}/memories/index.md`, indexDocument(`${label} 持久记忆`, [{
      title: "Memories and Context",
      entries: sortEntries(memories.map(conceptEntry)),
    }]));
    await writeUtf8(stagingRoot, `agent-history/${platform}/index.md`, indexDocument(`${label} 历史与记忆`, [{
      title: "Collections",
      entries: [
        { title: "会话历史", href: "conversations/", description: `${conversations.length} 个会话 Concepts。` },
        { title: "持久记忆", href: "memories/", description: `${memories.length} 份记忆或上下文文件。` },
        ...promptHistory.map((item) => ({ title: item.title, href: item.conceptId, description: item.description })),
      ],
    }]));
  }

  const conversationItems = items.filter((item) => item.object.kind === "conversation");
  const byProject = new Map();
  for (const item of conversationItems) {
    const project = projectFor(item);
    if (!byProject.has(project)) byProject.set(project, []);
    byProject.get(project).push(item);
  }
  const projectDirectory = [];
  for (const [project, projectItems] of [...byProject.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const projectId = sha256(project).slice(0, 16);
    await writeUtf8(stagingRoot, `agent-history/projects/${projectId}/index.md`, indexDocument(project, [{
      title: "Conversations",
      entries: sortEntries(projectItems.map(conceptEntry)),
    }]));
    projectDirectory.push({ title: project, href: `${projectId}/`, description: `${projectItems.length} 个跨平台会话。` });
  }
  await writeUtf8(stagingRoot, "agent-history/projects/index.md", indexDocument("Agent History 项目目录", [{
    title: "Projects",
    entries: projectDirectory,
  }]));
  const inactiveItems = items.filter((item) => !item.object.active);
  await writeUtf8(stagingRoot, "agent-history/inactive/index.md", indexDocument("Agent History Inactive Sources", [{
    title: "No Longer Present at Source",
    entries: sortEntries(inactiveItems.map(conceptEntry)),
  }]));

  const report = {
    schema_version: "1.0.0",
    okf_version: config.okf_version,
    raw_manifest_sha256: manifestSha,
    snapshot_timestamp: manifest.snapshot_at,
    policy: {
      raw_files_complete: true,
      raw_objects_immutable: true,
      stable_conversation_identity: "platform-plus-session-id",
      stable_memory_identity: "platform-kind-source-path-hash",
      readable_projection_roles: ["user", "assistant"],
      excluded_from_readable_projection: manifest.projection_policy?.excluded_from_okf ?? [],
      inactive_sources_retained: true,
      codex_memory_database_complete: manifest.coverage?.codex_memory_database?.status === "complete",
      public_publish: "explicit-human-approval-only",
    },
    counts: {
      ...manifest.counts,
      concepts: items.length,
      projects: byProject.size,
      parse_warnings: manifest.warnings.length,
    },
    warnings: manifest.warnings,
    items: items.map((item) => ({
      concept_id: item.conceptId,
      platform: item.object.platform,
      kind: item.object.kind,
      source_id: item.object.sourceId,
      source_path: item.object.sourcePath,
      source_state: item.object.sourceState,
      active: item.object.active,
      title: item.title,
      raw_object: item.object.raw.path,
      raw_sha256: item.object.raw.sha256,
      projection_object: item.object.projection?.path ?? null,
      projection_sha256: item.object.projection?.sha256 ?? null,
      messages: item.projection?.counts?.messages ?? 0,
      cwd: item.projection?.cwd ?? item.object.metadata?.cwd ?? null,
      created_at: item.projection?.createdAt ?? item.object.metadata?.createdAt ?? null,
      updated_at: item.projection?.updatedAt ?? item.object.metadata?.updatedAt ?? null,
      first_seen_at: item.object.firstSeenAt,
      last_changed_at: item.object.lastChangedAt,
      inactive_since: item.object.inactiveSince,
    })),
  };
  await writeUtf8(stagingRoot, "agent-history-curation.json", `${JSON.stringify(report, null, 2)}\n`);

  const reportBody = [
    "这份报告描述 Codex 与 Claude Code 本地历史如何进入私有 OKF Bundle，以及 Raw 完整性与可读投影之间的边界。",
    "",
    "## Outcome",
    "",
    `- 会话：${manifest.counts.conversations}（Codex ${manifest.counts.codex_conversations} / Claude Code ${manifest.counts.claude_code_conversations}）`,
    `- 记忆与上下文：${manifest.counts.memories}`,
    `- Codex SQLite 记忆：${manifest.counts.codex_memory_database_rows}`,
    `- 可读用户/助手消息：${manifest.counts.messages}`,
    `- Raw 字节：${manifest.counts.raw_bytes}`,
    `- 投影警告：${manifest.warnings.length}`,
    "",
    "## Update Policy",
    "",
    "- Raw 保存完整会话、记忆和索引文件；OKF 不覆盖 Raw。",
    "- 会话 Concept ID 使用平台加 session ID，文件追加、移动到归档目录后仍保持稳定。",
    "- 记忆 Concept ID 使用平台、类型和来源路径的稳定哈希。",
    "- 后续同步复用未变化文件，只处理新增、追加、移动或修改的来源。",
    "- 源文件消失时保留 inactive Concept 和历史 Raw，不静默删除。",
    "- OKF 对话正文只包含用户与助手文本；系统、开发者、推理、工具调用、工具结果和二进制内容只保留在 Raw。",
    "- 全部 Concepts 默认为 private，进入网站公开层必须逐条人工批准和脱敏。",
  ].join("\n");
  await writeUtf8(stagingRoot, "agent-history/curation-report.md", concept({
    type: "Curation Report",
    title: "Codex 与 Claude Code 历史 OKF 整理报告",
    description: "Codex 与 Claude Code 会话、记忆、Raw 完整性和增量更新摘要。",
    tags: ["agent-history", "codex", "claude-code", "okf", "curation"],
    timestamp: manifest.snapshot_at,
    source_system: "agent-history",
    raw_manifest_sha256: manifestSha,
    visibility: "private",
    review_status: "curated",
  }, "Codex 与 Claude Code 历史 OKF 整理报告", reportBody, "由确定性历史同步与投影规则生成；逐条明细见 Bundle 根目录 agent-history-curation.json。"));
  await writeUtf8(stagingRoot, "agent-history/index.md", indexDocument("Codex 与 Claude Code 历史知识", [{
    title: "Collections",
    entries: [
      { title: "Codex", href: "codex/", description: `${manifest.counts.codex_conversations} 个会话，${manifest.counts.codex_memories} 份记忆。` },
      { title: "Claude Code", href: "claude-code/", description: `${manifest.counts.claude_code_conversations} 个会话，${manifest.counts.claude_code_memories} 份记忆。` },
      { title: "项目目录", href: "projects/", description: `${byProject.size} 个工作目录的跨平台会话索引。` },
      { title: "Inactive 历史", href: "inactive/", description: `${inactiveItems.length} 个源端已不再存在的历史 Concepts。` },
      { title: "整理报告", href: "curation-report.md", description: "Raw、可读投影、隐私和增量更新边界。" },
    ],
  }]));
  const logDate = String(manifest.snapshot_at).slice(0, 10);
  await writeUtf8(stagingRoot, "agent-history/log.md", `# Agent History Bundle Update Log\n\n## ${logDate}\n\n* **Snapshot**: Generated from agent-history Raw manifest \`${manifestSha}\`.\n* **Conversations**: Codex ${manifest.counts.codex_conversations}; Claude Code ${manifest.counts.claude_code_conversations}.\n* **Memories**: Preserved ${manifest.counts.memories} memory/context files and ${manifest.counts.indexes} source indexes.\n* **Projection**: Emitted ${manifest.counts.messages} readable user/assistant messages; complete source bytes remain in Raw.\n* **Privacy**: Kept every generated Concept private and outside Git.\n`);

  return {
    manifest_sha256: manifestSha,
    snapshot_timestamp: manifest.snapshot_at,
    conversations: manifest.counts.conversations,
    memories: manifest.counts.memories,
    indexes: manifest.counts.indexes,
    prompt_histories: manifest.counts.prompt_histories,
    codex_conversations: manifest.counts.codex_conversations,
    codex_memory_database_rows: manifest.counts.codex_memory_database_rows,
    claude_code_conversations: manifest.counts.claude_code_conversations,
    messages: manifest.counts.messages,
    raw_bytes: manifest.counts.raw_bytes,
    projects: byProject.size,
    warnings: manifest.warnings.length,
    concepts: items.length + 1,
  };
}
