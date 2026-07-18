const PLATFORM_DIRECTORIES = {
  codex: "codex",
  "claude-code": "claude-code",
};

const UUID_EXACT_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const CODEX_CONTEXT_LINE_PATTERN = /^\s*\{\s*"timestamp"\s*:\s*[^,]+,\s*"type"\s*:\s*"(?:session_meta|turn_context)"\s*,\s*"payload"\s*:/u;
const CODEX_MESSAGE_LINE_PATTERN = /^\s*\{\s*"timestamp"\s*:\s*[^,]+,\s*"type"\s*:\s*"response_item"\s*,\s*"payload"\s*:\s*\{\s*"type"\s*:\s*"message"/u;
const CLAUDE_MESSAGE_LINE_PATTERN = /"type"\s*:\s*"(?:user|assistant)"/u;

function isoTimestamp(value) {
  const milliseconds = typeof value === "number" ? value : Date.parse(String(value ?? ""));
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
}

function cleanText(value) {
  return String(value ?? "").replaceAll("\u0000", "").trim();
}

function readableBlocks(content) {
  if (typeof content === "string") return cleanText(content);
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block && ["input_text", "output_text", "text"].includes(block.type))
    .map((block) => cleanText(block.text))
    .filter(Boolean)
    .join("\n\n");
}

function updateTimeRange(projection, timestamp) {
  const normalized = isoTimestamp(timestamp);
  if (!normalized) return;
  if (!projection.createdAt || normalized < projection.createdAt) projection.createdAt = normalized;
  if (!projection.updatedAt || normalized > projection.updatedAt) projection.updatedAt = normalized;
}

function titleFromText(value, fallback) {
  const title = cleanText(value)
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (!title) return fallback;
  return title.length > 120 ? `${title.slice(0, 119)}…` : title;
}

function requiredInteger(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(`codex-memory-row-${field}-invalid`);
  return number;
}

function optionalInteger(value, field) {
  if (value === null || value === undefined) return null;
  return requiredInteger(value, field);
}

function epochSeconds(value, field) {
  const seconds = requiredInteger(value, field);
  const timestamp = isoTimestamp(seconds * 1000);
  if (!timestamp) throw new Error(`codex-memory-row-${field}-invalid`);
  return timestamp;
}

export function normalizeCodexMemoryRow(row) {
  const threadId = cleanText(row?.thread_id).toLowerCase();
  if (!UUID_EXACT_PATTERN.test(threadId)) throw new Error("codex-memory-row-thread-id-invalid");
  const sourceUpdatedAt = requiredInteger(row.source_updated_at, "source-updated-at");
  const generatedAt = requiredInteger(row.generated_at, "generated-at");
  const rolloutSlug = cleanText(row.rollout_slug) || null;
  const titleSuffix = rolloutSlug ? rolloutSlug.replaceAll("_", " ") : threadId;
  return {
    sourcePath: `memory-database/stage1_outputs/${threadId}.json`,
    title: titleFromText(`Codex DB Memory · ${titleSuffix}`, `Codex DB Memory · ${threadId}`),
    metadata: {
      threadId,
      updatedAt: epochSeconds(sourceUpdatedAt, "source-updated-at"),
      generatedAt: epochSeconds(generatedAt, "generated-at"),
    },
    rawObject: {
      schema_version: "1.0.0",
      source_system: "codex-memory-database",
      source_table: "stage1_outputs",
      thread_id: threadId,
      source_updated_at: sourceUpdatedAt,
      raw_memory: String(row.raw_memory ?? ""),
      rollout_summary: String(row.rollout_summary ?? ""),
      rollout_slug: rolloutSlug,
      generated_at: generatedAt,
      usage_count: optionalInteger(row.usage_count, "usage-count"),
      last_usage: optionalInteger(row.last_usage, "last-usage"),
      selected_for_phase2: requiredInteger(row.selected_for_phase2, "selected-for-phase2"),
      selected_for_phase2_source_updated_at: optionalInteger(row.selected_for_phase2_source_updated_at, "selected-for-phase2-source-updated-at"),
    },
  };
}

export function renderCodexMemoryRow(value) {
  const row = typeof value === "string" ? JSON.parse(value) : value;
  if (row?.schema_version !== "1.0.0" || row?.source_system !== "codex-memory-database" || row?.source_table !== "stage1_outputs") {
    throw new Error("codex-memory-row-schema-unsupported");
  }
  const threadId = cleanText(row.thread_id);
  if (!UUID_EXACT_PATTERN.test(threadId)) throw new Error("codex-memory-row-thread-id-invalid");
  return [
    `这是 Codex 记忆数据库中 thread \`${threadId}\` 的稳定导出。`,
    "",
    "## Database Record",
    "",
    `- Source updated at：${epochSeconds(row.source_updated_at, "source-updated-at")}`,
    `- Generated at：${epochSeconds(row.generated_at, "generated-at")}`,
    `- Rollout slug：${cleanText(row.rollout_slug) || "无"}`,
    `- Selected for phase 2：${Number(row.selected_for_phase2) === 1 ? "yes" : "no"}`,
    "",
    "# Raw Memory",
    "",
    cleanText(row.raw_memory) || "_空_",
    "",
    "# Rollout Summary",
    "",
    cleanText(row.rollout_summary) || "_空_",
  ].join("\n");
}

export function createConversationProjection({ platform, sourceId, titleHint = null }) {
  if (!PLATFORM_DIRECTORIES[platform]) throw new Error(`agent-history-platform-unsupported:${platform}`);
  if (!sourceId) throw new Error("agent-history-source-id-missing");
  return {
    schema_version: "1.0.0",
    platform,
    sourceId: String(sourceId),
    titleHint: cleanText(titleHint) || null,
    cwd: null,
    gitBranch: null,
    parentSessionId: null,
    model: null,
    modelProvider: null,
    createdAt: null,
    updatedAt: null,
    summary: null,
    messages: [],
  };
}

export function isProjectionCandidateLine(platform, kind, line) {
  if (kind === "prompt-history") return true;
  const source = String(line);
  if (platform === "claude-code") return CLAUDE_MESSAGE_LINE_PATTERN.test(source);
  if (platform !== "codex") throw new Error(`agent-history-platform-unsupported:${platform}`);
  return CODEX_CONTEXT_LINE_PATTERN.test(source) || CODEX_MESSAGE_LINE_PATTERN.test(source);
}

function ingestCodexRecord(projection, record) {
  if (record?.type === "session_meta" && record.payload && typeof record.payload === "object") {
    projection.cwd = cleanText(record.payload.cwd) || projection.cwd;
    projection.parentSessionId = cleanText(record.payload.parent_thread_id) || projection.parentSessionId;
    projection.modelProvider = cleanText(record.payload.model_provider) || projection.modelProvider;
    updateTimeRange(projection, record.payload.timestamp ?? record.timestamp);
    return;
  }
  if (record?.type === "turn_context" && typeof record.payload?.summary === "string") {
    projection.summary = cleanText(record.payload.summary) || projection.summary;
    projection.model = cleanText(record.payload.model) || projection.model;
    updateTimeRange(projection, record.timestamp);
    return;
  }
  if (record?.type !== "response_item" || record.payload?.type !== "message") return;
  const role = record.payload.role;
  if (role !== "user" && role !== "assistant") return;
  const text = readableBlocks(record.payload.content);
  if (!text) return;
  const timestamp = isoTimestamp(record.timestamp);
  projection.messages.push({
    role,
    text,
    timestamp,
    sourceMessageId: cleanText(record.payload.id) || null,
  });
  updateTimeRange(projection, record.timestamp);
}

function ingestClaudeRecord(projection, record) {
  if (record?.type !== "user" && record?.type !== "assistant") return;
  const role = record.message?.role;
  if (role !== "user" && role !== "assistant") return;
  const text = readableBlocks(record.message?.content);
  if (!text) return;
  projection.cwd = cleanText(record.cwd) || projection.cwd;
  projection.gitBranch = cleanText(record.gitBranch) || projection.gitBranch;
  projection.model = cleanText(record.message?.model) || projection.model;
  projection.messages.push({
    role,
    text,
    timestamp: isoTimestamp(record.timestamp),
    sourceMessageId: cleanText(record.uuid) || null,
  });
  updateTimeRange(projection, record.timestamp);
}

export function ingestConversationRecord(projection, record) {
  if (projection.platform === "codex") ingestCodexRecord(projection, record);
  else if (projection.platform === "claude-code") ingestClaudeRecord(projection, record);
  else throw new Error(`agent-history-platform-unsupported:${projection.platform}`);
}

export function finalizeConversationProjection(projection) {
  const firstUserMessage = projection.messages.find((message) => message.role === "user")?.text;
  const fallback = `${projection.platform === "codex" ? "Codex" : "Claude Code"} 会话 ${projection.sourceId}`;
  const title = titleFromText(projection.titleHint || firstUserMessage, fallback);
  const messages = projection.messages.map((message, index) => ({ ...message, index: index + 1 }));
  return {
    schema_version: projection.schema_version,
    platform: projection.platform,
    sourceId: projection.sourceId,
    title,
    cwd: projection.cwd,
    gitBranch: projection.gitBranch,
    parentSessionId: projection.parentSessionId,
    model: projection.model,
    modelProvider: projection.modelProvider,
    createdAt: projection.createdAt,
    updatedAt: projection.updatedAt,
    summary: projection.summary,
    counts: {
      messages: messages.length,
      user: messages.filter((message) => message.role === "user").length,
      assistant: messages.filter((message) => message.role === "assistant").length,
    },
    messages,
  };
}

export function historyConceptId({ platform, kind, sourceId }) {
  const platformDirectory = PLATFORM_DIRECTORIES[platform];
  if (!platformDirectory) throw new Error(`agent-history-platform-unsupported:${platform}`);
  const id = String(sourceId ?? "");
  if (!/^[A-Za-z0-9._-]+$/u.test(id)) throw new Error(`agent-history-source-id-invalid:${id}`);
  if (kind === "conversation") return `/agent-history/${platformDirectory}/conversations/${id}.md`;
  if (kind === "memory") return `/agent-history/${platformDirectory}/memories/${id}.md`;
  if (kind === "prompt-history") return `/agent-history/${platformDirectory}/prompt-history.md`;
  throw new Error(`agent-history-concept-kind-unsupported:${kind}`);
}

export function historyObjectKey(value) {
  return `${value.platform}\u0000${value.kind}\u0000${value.sourceId ?? value.source_id}`;
}

export function projectionWarning(record) {
  const diagnostics = record?.metadata?.projectionDiagnostics;
  const invalidRelevantLines = Number(diagnostics?.invalidRelevantLines ?? 0);
  const oversizedLines = Number(diagnostics?.oversizedLines ?? 0);
  if (invalidRelevantLines <= 0 && oversizedLines <= 0) return null;
  return {
    code: "projection-lines-skipped",
    platform: record.platform,
    kind: record.kind,
    source_id: record.sourceId,
    invalid_relevant_lines: invalidRelevantLines,
    oversized_lines: oversizedLines,
  };
}

function recordIdentity(record) {
  return JSON.stringify({
    sourcePath: record.sourcePath,
    sourceState: record.sourceState,
    raw: record.raw,
    projection: record.projection,
    title: record.title,
    metadata: record.metadata,
  });
}

function changeRecord(source, overrides = {}) {
  return {
    platform: source.platform,
    kind: source.kind,
    sourceId: source.sourceId,
    added: false,
    updated: false,
    moved: false,
    stateChanged: false,
    deactivated: false,
    reactivated: false,
    ...overrides,
  };
}

export function planHistoryUpdate({ current, previous = [], observedAt }) {
  const timestamp = isoTimestamp(observedAt);
  if (!timestamp) throw new Error("agent-history-observed-at-invalid");
  const currentByKey = new Map(current.map((record) => [historyObjectKey(record), record]));
  const previousByKey = new Map(previous.map((record) => [historyObjectKey(record), record]));
  const keys = [...new Set([...currentByKey.keys(), ...previousByKey.keys()])].sort();
  const records = [];
  const changes = [];

  for (const key of keys) {
    const currentRecord = currentByKey.get(key);
    const previousRecord = previousByKey.get(key);
    if (currentRecord && !previousRecord) {
      records.push({
        ...currentRecord,
        active: true,
        firstSeenAt: timestamp,
        lastChangedAt: timestamp,
        inactiveSince: null,
      });
      changes.push(changeRecord(currentRecord, { added: true }));
      continue;
    }
    if (!currentRecord && previousRecord) {
      if (!previousRecord.active) {
        records.push(previousRecord);
        continue;
      }
      records.push({
        ...previousRecord,
        active: false,
        lastChangedAt: timestamp,
        inactiveSince: timestamp,
      });
      changes.push(changeRecord(previousRecord, { deactivated: true }));
      continue;
    }

    const updated = recordIdentity(currentRecord) !== recordIdentity(previousRecord);
    const moved = currentRecord.sourcePath !== previousRecord.sourcePath;
    const stateChanged = currentRecord.sourceState !== previousRecord.sourceState;
    const reactivated = !previousRecord.active;
    const changed = updated || reactivated;
    records.push({
      ...currentRecord,
      active: true,
      firstSeenAt: previousRecord.firstSeenAt,
      lastChangedAt: changed ? timestamp : previousRecord.lastChangedAt,
      inactiveSince: null,
    });
    if (changed) {
      changes.push(changeRecord(currentRecord, {
        updated,
        moved,
        stateChanged,
        reactivated,
      }));
    }
  }

  return { records, changes };
}
