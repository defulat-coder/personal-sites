import assert from "node:assert/strict";
import test from "node:test";

import { mergeRankings, publicAskVectorSource, splitText } from "../scripts/local-vectors.mjs";

test("splitText keeps chunks within the configured ceiling", () => {
  const chunks = splitText(`${"甲".repeat(15)}\n\n${"乙".repeat(30)}`, 20, 5);

  assert.deepEqual(chunks.map((chunk) => Array.from(chunk).length), [15, 20, 15]);
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
