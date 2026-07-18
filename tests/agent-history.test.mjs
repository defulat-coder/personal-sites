import assert from "node:assert/strict";
import test from "node:test";

import {
  createConversationProjection,
  finalizeConversationProjection,
  historyConceptId,
  historyObjectKey,
  ingestConversationRecord,
  isProjectionCandidateLine,
  normalizeCodexMemoryRow,
  planHistoryUpdate,
  projectionWarning,
  renderCodexMemoryRow,
} from "../scripts/lib/agent-history.mjs";

test("Codex projection keeps readable user and assistant messages while excluding developer and tool records", () => {
  const projection = createConversationProjection({
    platform: "codex",
    sourceId: "019f745e-d6b2-7700-9e8d-61c2b72f81b9",
    titleHint: "整理历史记忆",
  });
  const records = [
    {
      type: "session_meta",
      timestamp: "2026-07-18T08:00:00Z",
      payload: {
        id: "019f745e-d6b2-7700-9e8d-61c2b72f81b9",
        cwd: "/Users/xbjt/Documents/myself/personal-sites",
        parent_thread_id: null,
        model_provider: "openai",
      },
    },
    {
      type: "response_item",
      timestamp: "2026-07-18T08:01:00Z",
      payload: { type: "message", role: "developer", content: [{ type: "input_text", text: "internal instructions" }] },
    },
    {
      type: "response_item",
      timestamp: "2026-07-18T08:02:00Z",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: "请整理我的历史" }] },
    },
    {
      type: "response_item",
      timestamp: "2026-07-18T08:03:00Z",
      payload: { type: "custom_tool_call_output", output: "large private tool output" },
    },
    {
      type: "response_item",
      timestamp: "2026-07-18T08:04:00Z",
      payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "已经整理完成" }] },
    },
    {
      type: "turn_context",
      timestamp: "2026-07-18T08:05:00Z",
      payload: { summary: "会话压缩摘要" },
    },
  ];
  for (const record of records) ingestConversationRecord(projection, record);
  const result = finalizeConversationProjection(projection);

  assert.equal(result.title, "整理历史记忆");
  assert.equal(result.cwd, "/Users/xbjt/Documents/myself/personal-sites");
  assert.equal(result.summary, "会话压缩摘要");
  assert.deepEqual(result.messages.map(({ role, text }) => ({ role, text })), [
    { role: "user", text: "请整理我的历史" },
    { role: "assistant", text: "已经整理完成" },
  ]);
});

test("Claude Code projection keeps text dialogue and ignores tool-use payloads", () => {
  const projection = createConversationProjection({
    platform: "claude-code",
    sourceId: "21a3f325-c882-45fd-90d8-8bcc93c25b01",
  });
  const records = [
    {
      type: "user",
      timestamp: "2026-07-18T08:00:00Z",
      sessionId: "21a3f325-c882-45fd-90d8-8bcc93c25b01",
      cwd: "/Users/xbjt/Documents/myself/agent-claude",
      gitBranch: "main",
      message: { role: "user", content: "分析这个项目" },
    },
    {
      type: "assistant",
      timestamp: "2026-07-18T08:01:00Z",
      sessionId: "21a3f325-c882-45fd-90d8-8bcc93c25b01",
      message: {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "private chain of thought" },
          { type: "text", text: "这是项目分析" },
          { type: "tool_use", name: "Read", input: { file_path: "/tmp/a" } },
        ],
      },
    },
    {
      type: "user",
      timestamp: "2026-07-18T08:02:00Z",
      sessionId: "21a3f325-c882-45fd-90d8-8bcc93c25b01",
      message: { role: "user", content: [{ type: "tool_result", content: "tool output" }] },
    },
  ];
  for (const record of records) ingestConversationRecord(projection, record);
  const result = finalizeConversationProjection(projection);

  assert.equal(result.title, "分析这个项目");
  assert.equal(result.cwd, "/Users/xbjt/Documents/myself/agent-claude");
  assert.deepEqual(result.messages.map(({ role, text }) => ({ role, text })), [
    { role: "user", text: "分析这个项目" },
    { role: "assistant", text: "这是项目分析" },
  ]);
});

test("history concepts use stable source identities and later updates retain removed sessions as inactive", () => {
  const sourceId = "019f745e-d6b2-7700-9e8d-61c2b72f81b9";
  assert.equal(
    historyConceptId({ platform: "codex", kind: "conversation", sourceId }),
    `/agent-history/codex/conversations/${sourceId}.md`,
  );
  const current = [{
    platform: "codex",
    kind: "conversation",
    sourceId,
    sourcePath: "sessions/2026/07/18/example.jsonl",
    sourceState: "active",
    raw: { path: "blobs/aa/a.bin", sha256: "a".repeat(64), size: 10 },
    projection: { path: "objects/codex/conversation/x.json", sha256: "b".repeat(64) },
    title: "历史会话",
    active: true,
    firstSeenAt: null,
    lastChangedAt: null,
    inactiveSince: null,
  }];
  const initial = planHistoryUpdate({ current, previous: [], observedAt: "2026-07-18T08:00:00Z" });
  const removed = planHistoryUpdate({ current: [], previous: initial.records, observedAt: "2026-07-19T08:00:00Z" });

  assert.equal(initial.changes[0].added, true);
  assert.equal(removed.records[0].active, false);
  assert.equal(removed.records[0].inactiveSince, "2026-07-19T08:00:00.000Z");
  assert.equal(removed.changes[0].deactivated, true);
});

test("projection diagnostics remain reportable when an unchanged source is reused", () => {
  const warning = projectionWarning({
    platform: "codex",
    kind: "conversation",
    sourceId: "session-warning",
    metadata: {
      projectionDiagnostics: {
        invalidRelevantLines: 2,
        oversizedLines: 1,
      },
    },
  });

  assert.deepEqual(warning, {
    code: "projection-lines-skipped",
    platform: "codex",
    kind: "conversation",
    source_id: "session-warning",
    invalid_relevant_lines: 2,
    oversized_lines: 1,
  });
  assert.equal(projectionWarning({ platform: "codex", kind: "conversation", sourceId: "clean", metadata: { projectionDiagnostics: { invalidRelevantLines: 0, oversizedLines: 0 } } }), null);
});

test("Codex SQLite memories use stable thread paths and retain both memory representations", () => {
  const row = normalizeCodexMemoryRow({
    thread_id: "019f745e-d6b2-7700-9e8d-61c2b72f81b9",
    source_updated_at: 1784342755,
    raw_memory: "Durable fact",
    rollout_summary: "Conversation outcome",
    rollout_slug: "agent_history_sync",
    generated_at: 1784364568,
    usage_count: 2,
    last_usage: 1784365000,
    selected_for_phase2: 1,
    selected_for_phase2_source_updated_at: 1784342755,
  });

  assert.equal(row.sourcePath, "memory-database/stage1_outputs/019f745e-d6b2-7700-9e8d-61c2b72f81b9.json");
  assert.equal(row.title, "Codex DB Memory · agent history sync");
  assert.equal(row.metadata.updatedAt, "2026-07-18T02:45:55.000Z");
  assert.equal(row.rawObject.thread_id, "019f745e-d6b2-7700-9e8d-61c2b72f81b9");
  const readable = renderCodexMemoryRow(JSON.stringify(row.rawObject));
  assert.match(readable, /# Raw Memory[\s\S]*Durable fact/u);
  assert.match(readable, /# Rollout Summary[\s\S]*Conversation outcome/u);
});

test("projection prefilter only accepts top-level Codex messages", () => {
  const message = JSON.stringify({ timestamp: "2026-07-18T08:00:00Z", type: "response_item", payload: { type: "message", role: "user", content: [] } });
  const toolOutput = JSON.stringify({ timestamp: "2026-07-18T08:00:00Z", type: "response_item", payload: { type: "custom_tool_call_output", output: '{"type":"response_item","payload":{"type":"message"}}' } });

  assert.equal(isProjectionCandidateLine("codex", "conversation", message), true);
  assert.equal(isProjectionCandidateLine("codex", "conversation", toolOutput), false);
  assert.equal(historyObjectKey({ platform: "codex", kind: "conversation", source_id: "session" }), "codex\u0000conversation\u0000session");
});
