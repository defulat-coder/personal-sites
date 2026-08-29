import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ANALYSIS_ENGINE,
  resolveAnalysisConcurrency,
  resolveAnalysisEngine,
} from "../modules/analysis/runtime.mjs";

test("Codex is the shared default while Pi remains an explicit option", () => {
  assert.equal(DEFAULT_ANALYSIS_ENGINE, "codex-cli");
  assert.equal(resolveAnalysisEngine(), "codex-cli");
  assert.equal(resolveAnalysisEngine("pi"), "pi");
  assert.throws(() => resolveAnalysisEngine("other"), /仅支持 codex-cli 或 pi/u);
});

test("analysis concurrency follows the selected adapter and accepts an override", () => {
  assert.equal(resolveAnalysisConcurrency({ codex: 40, engine: "codex-cli", pi: 15 }), 40);
  assert.equal(resolveAnalysisConcurrency({ codex: 40, engine: "pi", pi: 15 }), 15);
  assert.equal(resolveAnalysisConcurrency({ codex: 40, engine: "codex-cli", override: 8, pi: 15 }), 8);
});
