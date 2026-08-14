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

// 词条在构建期（SSR/ISR）确定。SSR HTML 会被 ISR 长期缓存，而 hydration 发生在
// 之后的任意时刻，因此任何随机或时间种子都会在两端漂移、触发 hydration mismatch；
// 只有代码内的固定种子才能保证服务端渲染与客户端首次渲染产出同一份词条。
const SELECTED_TERMS = selectTechnicalTerms(0.61);

export function InteractiveDotField() {
  return (
    <div
      aria-label="以从右向左滚动的弹幕展示多种智能体开发技术词条"
      className="interactive-dot-field"
      role="img"
    >
      <div aria-hidden="true" className="interactive-dot-field__signals">
        {SELECTED_TERMS.map((term, index) => (
          <span className="interactive-dot-field__track" key={`${term}-${index}`}>
            <span className="interactive-dot-field__term">{term}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
