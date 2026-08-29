import assert from "node:assert/strict";
import test from "node:test";

import { isUsefulVectorChunk, mergeRankings, publicAskVectorSource, splitText } from "../scripts/local-vectors.mjs";

test("splitText keeps chunks within the configured ceiling", () => {
  const chunks = splitText(`${"甲".repeat(15)}\n\n${"乙".repeat(30)}`, 20, 5);

  assert.deepEqual(chunks.map((chunk) => Array.from(chunk).length), [15, 20, 15]);
});

test("splitText removes embedded base64 media before indexing Markdown", () => {
  const payload = "A".repeat(1_000);
  const chunks = splitText(`前文\n\n<img src="data:image/svg+xml;base64,${payload}">\n\n[徽章](https://img.shields.io/badge/test?logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2C${payload})\n\n后文`, 120, 20);

  assert.deepEqual(chunks, ["前文\n\n<img src=\"[embedded media]\">\n\n[徽章](https://img.shields.io/badge/test?logo=[embedded media])\n\n后文"]);
  assert.ok(chunks.every((chunk) => !chunk.includes(payload.slice(0, 100))));
});

test("vector indexing drops structural fragments with no useful retrieval context", () => {
  assert.equal(isUsefulVectorChunk("MIT"), false);
  assert.equal(isUsefulVectorChunk("## 📚 专题深入"), false);
  assert.equal(isUsefulVectorChunk("Agent 运行时通过持久化会话恢复长周期任务。"), true);
});

test("mergeRankings rewards results found by both retrieval methods", () => {
  const results = mergeRankings([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }]);

  assert.equal(results[0].id, 2);
  assert.deepEqual(new Set(results.map((result) => result.id)), new Set([1, 2, 3]));
});

test("public Ask vector sources stay unique across sections of one repository", () => {
  const base = { source_id: "repo-1", source_scope: "open-source" };
  assert.notEqual(
    publicAskVectorSource({ ...base, id: "open-source:repo:1" }),
    publicAskVectorSource({ ...base, id: "open-source:repo:2" }),
  );
});
