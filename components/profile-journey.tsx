const journeyStages = [
  { year: "2014", label: "Java · 运维", x: 0, y: 90, kind: "point" },
  { year: "2019", label: "业务 · 架构", x: 42, y: 72, kind: "point" },
  { year: "2023", label: "企业 AI", x: 75, y: 55, kind: "branch" },
  { year: "2026", label: "智能体平台", x: 100, y: 8, kind: "current" },
] as const;

const mainLinePath = "M 0 90 L 42 72 L 75 55 L 100 48";
const mainAreaPath = `${mainLinePath} L 100 100 L 0 100 Z`;
const branchLinePath = "M 75 55 C 81 47 85 28 100 8";

const POINT_DELAYS = [0.35, 1.05, 1.85, 2.6];
const LABEL_DELAYS = [0.55, 1.25, 2.0, 2.75];

export function ProfileJourney() {
  return (
    <section aria-label="职业历程" className="curation-home__journey">
      <div aria-hidden="true" className="curation-home__journey-chart">
        <svg className="journey-main" preserveAspectRatio="none" viewBox="0 0 100 100">
          <path className="curation-home__journey-area" d={mainAreaPath} />
          <path
            className="curation-home__journey-line-main"
            d={mainLinePath}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <svg className="journey-branch" preserveAspectRatio="none" viewBox="0 0 100 100">
          <path
            className="curation-home__journey-line-branch"
            d={branchLinePath}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {journeyStages.map((stage, index) => (
          <span
            className={`curation-home__journey-point${stage.kind === "branch" ? " is-branch" : ""}${stage.kind === "current" ? " is-current" : ""}`}
            key={stage.year}
            style={{ left: `${stage.x}%`, top: `${stage.y}%`, animationDelay: `${POINT_DELAYS[index]}s` }}
          />
        ))}
        <span className="curation-home__journey-cap curation-home__journey-cap--main">工程 · 业务</span>
        <span className="curation-home__journey-cap curation-home__journey-cap--branch">AI 能力</span>
      </div>
      <ol>
        {journeyStages.map((stage, index) => (
          <li
            className={stage.kind === "current" ? "is-current" : undefined}
            key={stage.year}
            style={{ left: `${stage.x}%`, animationDelay: `${LABEL_DELAYS[index]}s` }}
          >
            <span className="curation-home__journey-year">{stage.year}</span>
            <span className="curation-home__journey-label">{stage.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
