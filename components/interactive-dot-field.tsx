"use client";

import { useEffect, useState } from "react";

export const TECHNICAL_TERM_SETS = [
  [
    "agent.runtime", "multi.agent", "workflow.graph", "tool.call()",
    "mcp.protocol", "skills.registry", "prompt.ops", "context.engine",
    "observe.trace", "eval.loop", "rag.retrieval", "vector.search",
  ],
  [
    "sse.stream", "ship.systems", "code.diff", "session.state",
    "planner.agent", "executor.agent", "router.policy", "memory.store",
    "context.window", "model.gateway", "structured.output", "function.calling",
  ],
  [
    "retry.policy", "human.in.loop", "agent.runtime", "tool.call()",
    "rag.retrieval", "sse.stream", "planner.agent", "memory.store",
    "function.calling", "eval.loop", "context.engine", "ship.systems",
  ],
  [
    "workflow.graph", "mcp.protocol", "skills.registry", "prompt.ops",
    "vector.search", "code.diff", "session.state", "executor.agent",
    "router.policy", "context.window", "model.gateway", "structured.output",
  ],
] as const;

export function selectTechnicalTerms(randomValue: number) {
  const normalizedRandom = Number.isFinite(randomValue)
    ? Math.min(Math.max(randomValue, 0), 1 - Number.EPSILON)
    : 0;
  const index = Math.floor(normalizedRandom * TECHNICAL_TERM_SETS.length);
  return TECHNICAL_TERM_SETS[index];
}

export function InteractiveDotField() {
  const [terms, setTerms] = useState<readonly string[]>([]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTerms(selectTechnicalTerms(Math.random()));
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      aria-label="以从右向左滚动的弹幕展示多种智能体开发技术词条"
      className="interactive-dot-field"
      role="img"
    >
      <div aria-hidden="true" className="interactive-dot-field__signals">
        {terms.map((term, index) => (
          <span className="interactive-dot-field__term" key={`${term}-${index}`}>
            {term}
          </span>
        ))}
      </div>
    </div>
  );
}
