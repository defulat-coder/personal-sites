import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { generateAgentHistoryBundle } from "../scripts/agent-history-to-okf.mjs";

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function contentAddressed(root, relative, bytes) {
  await mkdir(path.join(root, path.dirname(relative)), { recursive: true });
  await writeFile(path.join(root, relative), bytes);
}

test("agent-history generator produces readable conversation and memory concepts with Raw provenance", async (context) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "agent-history-okf-"));
  context.after(() => rm(temporary, { recursive: true, force: true }));
  const rawRoot = path.join(temporary, "raw");
  const stagingRoot = path.join(temporary, "bundle");
  await mkdir(rawRoot, { recursive: true });
  await mkdir(stagingRoot, { recursive: true });

  const conversationId = "019f745e-d6b2-7700-9e8d-61c2b72f81b9";
  const rawConversation = Buffer.from('{"type":"response_item","payload":{"type":"message"}}\n', "utf8");
  const rawConversationSha = digest(rawConversation);
  const rawConversationPath = `blobs/${rawConversationSha.slice(0, 2)}/${rawConversationSha}.blob`;
  await contentAddressed(rawRoot, rawConversationPath, rawConversation);
  const projection = {
    schema_version: "1.0.0",
    platform: "codex",
    sourceId: conversationId,
    title: "整理历史记忆",
    cwd: "/Users/xbjt/Documents/myself/personal-sites",
    gitBranch: "main",
    parentSessionId: null,
    model: "gpt-5",
    modelProvider: "openai",
    createdAt: "2026-07-18T08:00:00.000Z",
    updatedAt: "2026-07-18T08:05:00.000Z",
    summary: "整理 Codex 和 Claude Code 历史。",
    counts: { messages: 2, user: 1, assistant: 1 },
    messages: [
      { index: 1, role: "user", text: "请整理历史", timestamp: "2026-07-18T08:01:00.000Z", sourceMessageId: "u1" },
      { index: 2, role: "assistant", text: "已经整理", timestamp: "2026-07-18T08:02:00.000Z", sourceMessageId: "a1" },
    ],
  };
  const projectionBytes = Buffer.from(`${JSON.stringify(projection, null, 2)}\n`, "utf8");
  const projectionSha = digest(projectionBytes);
  const projectionPath = `objects/codex/conversation/${conversationId}/${projectionSha}.json`;
  await contentAddressed(rawRoot, projectionPath, projectionBytes);

  const memoryId = "a".repeat(32);
  const memoryBytes = Buffer.from("# Durable Memory\n\nAlways preserve unrelated work.\n", "utf8");
  const memorySha = digest(memoryBytes);
  const memoryPath = `blobs/${memorySha.slice(0, 2)}/${memorySha}.blob`;
  await contentAddressed(rawRoot, memoryPath, memoryBytes);
  const objects = [
    {
      platform: "codex",
      kind: "conversation",
      sourceId: conversationId,
      sourcePath: "sessions/2026/07/18/example.jsonl",
      sourceState: "active",
      raw: { path: rawConversationPath, sha256: rawConversationSha, size: rawConversation.length },
      projection: { path: projectionPath, sha256: projectionSha, size: projectionBytes.length },
      title: projection.title,
      metadata: { cwd: projection.cwd, createdAt: projection.createdAt, updatedAt: projection.updatedAt, messageCounts: projection.counts },
      active: true,
      firstSeenAt: "2026-07-18T08:00:00.000Z",
      lastChangedAt: "2026-07-18T08:00:00.000Z",
      inactiveSince: null,
    },
    {
      platform: "codex",
      kind: "memory",
      sourceId: memoryId,
      sourcePath: "memories/MEMORY.md",
      sourceState: "active",
      raw: { path: memoryPath, sha256: memorySha, size: memoryBytes.length },
      projection: null,
      title: "MEMORY",
      metadata: { format: "md", createdAt: null, updatedAt: null },
      active: true,
      firstSeenAt: "2026-07-18T08:00:00.000Z",
      lastChangedAt: "2026-07-18T08:00:00.000Z",
      inactiveSince: null,
    },
  ];
  const manifestBytes = Buffer.from(`${JSON.stringify({
    schema_version: "1.0.0",
    source_system: "agent-history",
    snapshot_at: "2026-07-18T08:10:00.000Z",
    complete: true,
    projection_policy: { raw_files_complete: true, readable_roles: ["user", "assistant"] },
    coverage: { codex_memory_database: { required: true, status: "complete", stage1_outputs: 0 } },
    counts: { objects: 2, active: 2, inactive: 0, conversations: 1, memories: 1, indexes: 0, prompt_histories: 0, codex_conversations: 1, codex_memories: 1, codex_memory_database_rows: 0, codex_memory_database_snapshots: 0, claude_code_conversations: 0, claude_code_memories: 0, raw_bytes: rawConversation.length + memoryBytes.length, messages: 2 },
    objects,
    changes: [],
    warnings: [],
    errors: [],
  }, null, 2)}\n`, "utf8");

  const result = await generateAgentHistoryBundle({
    config: { okf_version: "0.1" },
    rawRoot,
    stagingRoot,
    manifest: JSON.parse(manifestBytes.toString("utf8")),
    manifestBytes,
  });

  assert.equal(result.conversations, 1);
  assert.equal(result.memories, 1);
  const conversation = await readFile(path.join(stagingRoot, `agent-history/codex/conversations/${conversationId}.md`), "utf8");
  assert.match(conversation, /^---\ntype: "Agent Conversation"/u);
  assert.match(conversation, new RegExp(`source_object: ${JSON.stringify(rawConversationPath)}`, "u"));
  assert.match(conversation, /## User · 2026-07-18T08:01:00.000Z[\s\S]*请整理历史/u);
  assert.match(conversation, /## Assistant · 2026-07-18T08:02:00.000Z[\s\S]*已经整理/u);
  assert.doesNotMatch(conversation, /developer|tool output/iu);
  const memory = await readFile(path.join(stagingRoot, `agent-history/codex/memories/${memoryId}.md`), "utf8");
  assert.match(memory, /Always preserve unrelated work/u);
  const report = JSON.parse(await readFile(path.join(stagingRoot, "agent-history-curation.json"), "utf8"));
  assert.equal(report.items.length, 2);
});
