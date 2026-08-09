const TECHNICAL_TERMS = [
  "agent.runtime",
  "multi.agent",
  "workflow.graph",
  "tool.call()",
  "mcp.protocol",
  "skills.registry",
  "prompt.ops",
  "context.engine",
  "observe.trace",
  "eval.loop",
  "rag.retrieval",
  "vector.search",
  "sse.stream",
  "ship.systems",
  "code.diff",
  "session.state",
  "planner.agent",
  "executor.agent",
  "router.policy",
  "memory.store",
  "context.window",
  "model.gateway",
  "structured.output",
  "function.calling",
  "retry.policy",
  "human.in.loop",
];

export function InteractiveDotField() {
  return (
    <div
      aria-label="以隐藏显示的不规则技术信号节点展示多种智能体开发技术词条"
      className="interactive-dot-field"
      role="img"
    >
      <div aria-hidden="true" className="interactive-dot-field__signals">
        {TECHNICAL_TERMS.map((term, index) => (
          <span className="interactive-dot-field__term" key={`${term}-${index}`}>
            {term}
          </span>
        ))}
      </div>
    </div>
  );
}
