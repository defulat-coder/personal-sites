export type AnalysisEngine = "codex-cli" | "pi";

export const ANALYSIS_ENGINES: AnalysisEngine[];
export const DEFAULT_ANALYSIS_ENGINE: AnalysisEngine;
export function resolveAnalysisEngine(value?: string): AnalysisEngine;
export function resolveAnalysisConcurrency(options: {
  codex?: number;
  engine: AnalysisEngine;
  override?: number | null;
  pi?: number;
}): number;
