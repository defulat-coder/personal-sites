export const ANALYSIS_ENGINES = ["codex-cli", "pi"];
export const DEFAULT_ANALYSIS_ENGINE = "codex-cli";

export function resolveAnalysisEngine(value = DEFAULT_ANALYSIS_ENGINE) {
  if (!ANALYSIS_ENGINES.includes(value)) throw new Error("--engine 仅支持 codex-cli 或 pi。");
  return value;
}

export function resolveAnalysisConcurrency({ codex = 1, engine, override = null, pi = 15 }) {
  const concurrency = override ?? (resolveAnalysisEngine(engine) === "codex-cli" ? codex : pi);
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("并发数必须是大于 0 的整数。");
  return concurrency;
}
