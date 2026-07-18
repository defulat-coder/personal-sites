# Loop Opportunities — 2026-07-18
Scanned: 14 Claude sessions, 695 Codex sessions, 90 days

The digest contained replayed approval/browser context, so ranking uses distinct dates, sessions,
projects, and prompt shapes rather than raw hit count alone.

## Ranked loop opportunities

### 1. Reference-driven UI parity loop
- **Signal**: Repeated asks + babysat sessions + explicit run-until-done language.
- **Evidence**: 23 distinct prompt shapes across 22 sessions, 8 days, and 7 projects (2026-06-19 → 2026-07-18). Examples: 2026-06-19, “逐页面完成开发、验证和迭代……截图工具对比，并且 1:1 还原”; 2026-06-20, “观察当前界面 → 找出样式问题 → 小步修复 → 重新运行/检查”; 2026-07-15, “不要给我填充内容……先给我原样复刻”. The current personal-site request also starts from a reference site, so this pattern directly fits this project.
- **Proposed loop**: `/goal` loop, one bounded page/section/state per iteration: inspect reference → capture baseline → implement the smallest parity slice → run browser checks → compare screenshots/console/network → update state → select the next highest-value slice.
- **Stop/verification**: Target route and required states work at agreed desktop/mobile sizes; no console or failed-network regressions; screenshot differences are below an agreed threshold or every remaining difference is explicitly accepted. (readiness: needs-encoding)
- **Payoff**: Removes repeated “continue / 再看一遍 / 原样复刻” steering; likely saves 1–3 hours of babysitting per active UI week and leaves resumable state.
- **Cost caution**: Roughly 1–3 slices/week × 60k–150k tokens plus browser/screenshot work; keep each run to one page or state and cap iterations.
- **Confidence**: high

### 2. Architecture deepening loop
- **Signal**: Repeated asks + explicit `/goal` use + follow-up obligation to live-test, review, and commit.
- **Evidence**: 10 distinct prompt shapes across 8 sessions, 9 days, and 7 projects (2026-06-19 → 2026-07-15). Examples: 2026-06-19, “refactor until you are happy with the architecture……live test……autoreview/commit”; 2026-07-02, invoking `improve-codebase-architecture`; 2026-07-11, “任务做完后，做一个架构审查”.
- **Proposed loop**: `/goal` loop per bounded subsystem: orient → collect high-confidence deepening candidates → choose one coherent slice → implement → run repo-native tests and live verification → architecture review → record progress and next candidate.
- **Stop/verification**: No unresolved high-confidence issue remains inside the declared subsystem; all relevant tests/typechecks/builds and one runtime path pass; review findings are resolved or escalated; diff and progress log are complete. (readiness: needs-encoding)
- **Payoff**: Replaces repeated restart prompts and “until happy” judgment with a durable queue and explicit gates; likely removes 1–2 steering sessions per refactor and saves 30–90 minutes/week while architecture work is active.
- **Cost caution**: About 1 slice/week × 40k–100k tokens; architecture scope must be fixed before each run or the loop can expand indefinitely.
- **Confidence**: high

### 3. Local runtime bring-up and proof loop
- **Signal**: Repeated asks + re-explained environment preferences + manual verification.
- **Evidence**: 24 distinct prompt shapes across 18 sessions, 11 days, and 9 projects (2026-06-13 → 2026-07-12). Examples: 2026-06-20, “给我启动下项目”; 2026-07-05, “重新启动一下服务，然后验证一下”; 2026-07-10, “验证直接本地……只有明确要求才用 Docker”.
- **Proposed loop**: `/goal` loop scoped to one repo: read repo instructions → resolve runtime/dependency state → start the lightest native stack unless Docker is explicitly required → probe health endpoints → exercise the target browser/simulator/API flow → capture evidence → repair and retry within budget.
- **Stop/verification**: Every declared service is reachable, the named health checks pass, the target user flow succeeds, and the exact start/stop commands plus observed URLs/ports are recorded. (readiness: ready when a repo verification script exists; otherwise needs-encoding)
- **Payoff**: Turns repeated startup handoffs into one evidence-bearing run; likely saves 30–60 minutes/week across active repos and prevents “process started” from being mistaken for “feature works”.
- **Cost caution**: Roughly 3–5 runs/week × 5k–20k tokens; cap retries and avoid expensive Docker rebuilds unless the spec calls for them.
- **Confidence**: high

### 4. Project Skills hygiene loop
- **Signal**: Repeated asks + re-explained management rules + follow-up obligations after installation.
- **Evidence**: 19 distinct prompt shapes across 14 sessions, 8 days, and 5 projects (2026-05-23 → 2026-07-18). Examples: 2026-07-11, “期望用 npx Skills 命令来做项目的 Skills 管理”; 2026-07-11, “没有在 .codex 和 .claude 里边有软链接”; 2026-07-13, “后续所有技能相关的管理统一通过 npx skills”.
- **Proposed loop**: Monthly or on-demand maintenance loop: inspect `skills-lock.json` → check upstream changes and risk deltas → update approved Skills → verify referenced resources → verify Codex and Claude Code discovery → report additions, removals, drift, and manual decisions.
- **Stop/verification**: Lock entries, installed trees, supporting files, and both agent discovery lists reconcile; no unapproved Skill is added; security-risk changes are surfaced for review. (readiness: ready)
- **Payoff**: Consolidates recurring install/link/lock verification into one pass; saves roughly 15–30 minutes per active repo maintenance cycle.
- **Cost caution**: One monthly/on-demand run × 5k–15k tokens plus network checks; do not auto-update Skills whose behavior or permissions changed.
- **Confidence**: medium-high

### 5. Official-source Agent ecosystem research monitor
- **Signal**: Repeated asks for current best practices, project fit, and production integration; some re-explained context.
- **Evidence**: 25 distinct prompt shapes across 20 sessions, 10 days, and 4 projects (2026-07-04 → 2026-07-18). Examples: 2026-07-11, “看一下官方的最佳实践”; 2026-07-15, asking whether CopilotKit fits Claude Agent SDK; 2026-07-18, asking for current semantic-layer/data-agent practices and popular GitHub projects.
- **Proposed loop**: Weekly watchlist over selected official docs, release notes, and upstream repositories: compare against last-seen state → extract only material changes → assess fit for the active platform → write a source-linked digest with recommended action or “no change”.
- **Stop/verification**: Every claim has a primary-source link and observation date; novelty is checked against prior state; facts and inference are separated; each item ends with adopt / investigate / ignore. (readiness: ready)
- **Payoff**: Replaces at least one recurring ad-hoc research session with a compact delta report; likely saves 30–60 minutes/week when the Agent platform is active.
- **Cost caution**: One run/week × 20k–50k tokens and web access; keep the watchlist narrow or the digest becomes expensive noise.
- **Confidence**: medium

## Hook opportunities (event-triggered, deterministic)

- **Task-completion Git handoff** — 14 distinct short formulations across 22 sessions, 15 days, and 10 projects asked for commit/push/merge. This is a completion event, not a stateful loop. A hook should run repo-native checks, show status/diff, prepare an atomic commit, and apply the repository's explicit push policy; merge and other external effects remain gated.
- **Post-task architecture review** — The user explicitly expects an architecture review after implementation. A read-only completion hook can scan the final diff, emit actionable findings, and reopen the task only for high-confidence issues; the deeper refactor remains Loop #2.
- **Secret guard for generated artifacts** — Before reports or staged changes leave the machine, scan for access tokens, credentials, and private prompt material. This scan found a likely credential in historical prompt text; it is excluded from this report, and the private digest directory is now ignored.
- **Native verification selector** — On task completion, choose the repo-native gate first; invoke Docker only when the project or user explicitly requires it. This encodes the repeatedly stated local-verification preference without scheduling background work.

## Skill opportunities (context to encode once)

- **Per-project verification Skill** — Use `loop-verify` in each active repo to encode exact start commands, health endpoints, browser/simulator paths, expected states, evidence files, and cleanup. Loops #1–#3 should call this instead of reinventing “done”.
- **Reference-parity evaluator** — Encode viewport matrix, screenshot naming, allowed dynamic regions, diff threshold, console/network policy, and acceptance workflow once; keep implementation orchestration in Loop #1.
- **Repo fit research contract** — Reuse the existing `research` Skill but specialize project rules around official sources, project positioning, production-fit judgment, integration seams, and dated evidence. The history shows this context being restated across Agent projects.
- **Project-managed Skill install contract** — Most of this is already captured by `find-skills`, `skill-installer`, and the repository's `npx skills` convention. Prefer a short governance rule plus those existing Skills over creating another overlapping installer Skill.

## Not worth automating (and why)

- **Unattended auto-push or auto-merge** — The repeated prompts are real, but branch choice, unrelated dirty work, remote state, and external effects require current context. Automate checks and preparation; keep the irreversible boundary explicit.
- **Personal-site Yuque → OKF scheduled sync, for now** — This appears only in one day's history, the desired refresh cadence is not established, and a historical prompt contains a likely credential. First rotate/secure credentials, complete one deterministic baseline sync, and encode verification; promote it to a loop only after a second real refresh need.
- **One giant “build every project until perfect” loop** — “Perfect”, “production-grade”, and “1:1” are not stop conditions. Split work by project and bounded page/subsystem, then call an encoded verifier.
- **General repository explanation loop** — Project walkthroughs and fit questions recur, but each repository is fresh input and usually needs human intent. This is better served by a research/orientation Skill than unattended repetition.

## Next step

Run `loop-generate` on loop #1: design a bounded reference-driven personal-site loop using the chosen reference site, the existing resume/project evidence, one page or section per iteration, screenshot/browser verification, a token budget, and an explicit human-review stop condition.
