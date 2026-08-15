import type { CSSProperties } from "react";

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

// 技术栈词条：前半复刻 aryankarma.com 的 Skills 列表，后半为国内常用的 Java 技术栈。
export const TECH_STACK_TERMS = [
  "React.js", "Next.js", "TypeScript", "Node.js", "Python", "Postgres",
  "Docker", "Kubernetes", "Tailwind CSS", "Git/GitHub", "JavaScript",
  "Sass", "Express.js", "Redux", "Java", "Spring", "Spring Boot",
  "Spring Cloud", "MyBatis", "MySQL", "Redis", "RabbitMQ", "Elasticsearch",
  "Maven", "Nginx",
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
const SELECTED_TERMS = [...selectTechnicalTerms(0.61), ...TECH_STACK_TERMS];

// 弹幕泳道：词条按索引取模分配到六条水平泳道；词条多了之后同屏全放太密，
// 因此每条泳道内再分 TERM_SUBGROUPS 组轮换入场——关键帧只在周期前
// 1/TERM_SUBGROUPS 划过屏幕，其余时间隐藏等待，同屏词条数始终约为总数的
// 1/TERM_SUBGROUPS，保持与原来 12 词相当的稀疏度。
const TERM_LANES = [
  { top: "2%", duration: 21 },
  { top: "19%", duration: 23 },
  { top: "36%", duration: 20 },
  { top: "52%", duration: 27 },
  { top: "68%", duration: 24 },
  { top: "84%", duration: 22 },
] as const;

const TERM_SUBGROUPS = 3;

// 每个词条的滚动参数都是索引的纯函数，服务端与客户端必然算出同一份结果。
function trackStyle(index: number, total: number): CSSProperties {
  const lane = index % TERM_LANES.length;
  const order = Math.floor(index / TERM_LANES.length);
  const laneSize = Math.floor(total / TERM_LANES.length) + (lane < total % TERM_LANES.length ? 1 : 0);
  const subgroup = order % TERM_SUBGROUPS;
  const slot = Math.floor(order / TERM_SUBGROUPS);
  const subgroupSize = Math.floor(laneSize / TERM_SUBGROUPS) + (subgroup < laneSize % TERM_SUBGROUPS ? 1 : 0);
  const { top, duration: baseDuration } = TERM_LANES[lane];
  // 同组词条等相位差，组间错开一个完整划过窗口，任意时刻同泳道词条互不重叠。
  const delay = -(subgroup * baseDuration + (slot / subgroupSize) * baseDuration + lane * 1.7);
  const drift = (index % 2 === 0 ? 1 : -1) * (0.06 + (index % 3) * 0.03);
  const opacity = 0.62 + ((index * 7) % 5) * 0.075;

  return {
    "--term-top": top,
    "--term-duration": `${baseDuration * TERM_SUBGROUPS}s`,
    "--term-delay": `${delay.toFixed(2)}s`,
    "--term-drift": `${drift.toFixed(2)}rem`,
    "--term-opacity": opacity.toFixed(3),
  } as CSSProperties;
}

export function InteractiveDotField() {
  return (
    <div
      aria-label="以从右向左滚动的弹幕展示智能体开发术语与个人技术栈"
      className="interactive-dot-field"
      role="img"
    >
      <div aria-hidden="true" className="interactive-dot-field__signals">
        {SELECTED_TERMS.map((term, index) => (
          <span
            className="interactive-dot-field__track"
            key={`${term}-${index}`}
            style={trackStyle(index, SELECTED_TERMS.length)}
          >
            <span className="interactive-dot-field__term">{term}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
