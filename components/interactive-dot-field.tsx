import type { CSSProperties } from "react";

import { DotFieldParallax } from "@/components/dot-field-parallax";

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

// 弹幕泳道：词条按索引取模分配到六条水平泳道。每条泳道只动一个连续轨道，
// 轨道内用足够大的固定间隔保持同屏稀疏；复制序列只用于无缝循环。
const TERM_LANES = [
  { top: "2%", duration: 21 },
  { top: "19%", duration: 23 },
  { top: "36%", duration: 20 },
  { top: "52%", duration: 27 },
  { top: "68%", duration: 24 },
  { top: "84%", duration: 22 },
] as const;

const TERM_SUBGROUPS = 3;

const TERMS_BY_LANE = TERM_LANES.map((_, lane) =>
  SELECTED_TERMS.flatMap((term, index) => index % TERM_LANES.length === lane ? [{ index, term }] : []),
);

// 每条泳道的滚动参数都是索引的纯函数，服务端与客户端必然算出同一份结果。
function trackStyle(lane: number): CSSProperties {
  const { top, duration } = TERM_LANES[lane];
  const drift = (lane % 2 === 0 ? 1 : -1) * (0.06 + (lane % 3) * 0.03);

  return {
    "--term-top": top,
    "--term-duration": `${duration * TERM_SUBGROUPS}s`,
    "--term-delay": `${(-lane * 1.7).toFixed(2)}s`,
    "--term-drift": `${drift.toFixed(2)}rem`,
  } as CSSProperties;
}

function renderTerms(
  terms: (typeof TERMS_BY_LANE)[number],
  repeated = false,
) {
  return terms.map(({ index, term }) => (
    <span
      className="interactive-dot-field__term"
      data-emphasis={index === 0 || index === 8 ? "strong" : index === 4 ? "medium" : undefined}
      data-static-align={!repeated && index < TECHNICAL_TERM_SETS[0].length
        ? index % 3 === 0 ? "start" : index % 3 === 2 ? "end" : undefined
        : undefined}
      data-static-term={!repeated && index < TECHNICAL_TERM_SETS[0].length ? "" : undefined}
      key={`${repeated ? "repeat" : "original"}-${term}-${index}`}
      style={{ "--term-order": index } as CSSProperties}
    >
      {term}
    </span>
  ));
}

export function InteractiveDotField() {
  return (
    <div
      aria-label="技术词条动效"
      className="interactive-dot-field"
      role="group"
    >
      <DotFieldParallax>
        {TERMS_BY_LANE.map((terms, lane) => (
          <span className="interactive-dot-field__lane" key={lane}>
            <span className="interactive-dot-field__track" style={trackStyle(lane)}>
              <span className="interactive-dot-field__sequence">
                {renderTerms(terms)}
              </span>
              <span aria-hidden="true" className="interactive-dot-field__sequence interactive-dot-field__sequence--repeat">
                {renderTerms(terms, true)}
              </span>
            </span>
          </span>
        ))}
      </DotFieldParallax>
    </div>
  );
}
