<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Instructions

- Unless explicitly requested, do not preserve backward compatibility: replace old APIs and data structures directly, without compatibility layers, migration bridges, or fallback branches.

## Runtime and Checks

- Use `pnpm` with Node.js `>=22.19.0`; the package manager is pinned in `package.json`.
- Default dev startup is domain-based via portless: `pnpm dev:domain` serves `https://personal-site.localhost` (fixed app port 3000, so `SITE_BASE_URL=http://127.0.0.1:3000` for iOS/Android keeps working). Plain `pnpm dev` stays available for raw-port use.
- Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` for changes spanning app code or configuration.
- `pnpm typecheck` deliberately invokes TypeScript 7; keep `typescript@6` for the Next.js and ESLint API compatibility layer. See `scripts/tsc7.mjs`.
- For a second dev server, use `pnpm exec next dev --turbopack --hostname 127.0.0.1 --port 7100`; do not use `pnpm dev -- --port 7100`.

## File-Scoped Commands

| Task | Command |
| --- | --- |
| Lint one file | `pnpm exec eslint path/to/file.tsx` |
| Run one Vitest file | `pnpm exec vitest run path/to/file.test.ts` |
| Typecheck | `pnpm typecheck` |
| Git boundary audit | `pnpm git:safety` |

## Frontend

- Treat `PRODUCT.md` (strategic context), `DESIGN.md` and `docs/frontend-architecture.md` as the current UI source of truth; `docs/redesign-plan.md` is historical.
- Preserve the desktop-first identity rail plus continuous content-flow layout. Do not restore the legacy knowledge/workspace shell or introduce card grids, glass, heavy shadows, or broad accent colors.
- Reuse the identity rail on detail pages. New motion needs cleanup, a stable final state, and a `prefers-reduced-motion` path.
- Use the Next runtime plus browser verification after UI changes; inspect compiler issues, routes, browser errors, and the rendered interaction.

## Data, Privacy, and Caching

- Read `docs/sensitive-data.md` before touching curation inputs or credentials. Never stage, publish, render, screenshot, or expose `data/sensitive/`, `knowledge/sensitive/`, local credentials, or `tools/smaug/.state/`.
- The public site reads only Supabase public projections; never add a fallback from browser or runtime code to sensitive local data. Service-role keys never belong in `NEXT_PUBLIC_*` variables.
- Keep public curation detail reads cacheable with ISR (`revalidate = 300`) and loading states. For cache changes, verify production route classification and `x-nextjs-cache` MISS then HIT behavior.
- Treat `curation:*`, `github:starred:*`, `ai-news:sync`, and `supabase:push` as external data operations. Follow `docs/supabase-x-sync.md`, `docs/github-starred-sync.md`, and `docs/ai-news-sync.md`; use `pnpm supabase:push -- --dry-run` before a database write. Run daily Star syncs one at a time and report partial results until the process exits. `ai-news:sync` runs on GitHub Actions every 5 minutes (`.github/workflows/ai-news-sync.yml`; launchd on this machine is an optional fallback); the site only reads the `ai_news_public_items` projection.

## iOS App

- `ios/` holds the native SwiftUI client (Swift 6, iOS 17+); see `docs/ios-app.md` for architecture and data flow. The Xcode project uses synchronized folders — new Swift files need no `project.pbxproj` edits.
- Build/test from `ios/`: `xcodebuild -scheme PersonalSite -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build|test`.
- `ios/Secrets.xcconfig` (gitignored) carries only `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SITE_BASE_URL`. Service-role and LLM keys never enter the app.
- Data contract source of truth stays in `lib/*-types.ts`; when those types or `/api/*` shapes change, update `ios/PersonalSite/Models/` and `SiteAPIClient` accordingly.

## Android App

- `android/` holds the native Kotlin + Jetpack Compose client (minSdk 26, compileSdk 36, AGP 8.13 + Gradle 8.14, 2025 年稳定依赖线); see `docs/android-app.md`. Feature and data-access parity with `ios/` is the design constraint.
- Build/test from `android/`: `JAVA_HOME=$(/usr/libexec/java_home -v 17) ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ./gradlew :app:assembleDebug` and `./gradlew :app:testDebugUnitTest`.
- `android/local.properties` (gitignored) carries only `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SITE_BASE_URL` (emulator dev: `http://10.0.2.2:3000`). Service-role and LLM keys never enter the app.
- When `lib/*-types.ts` or `/api/*` shapes change, update `android/app/src/main/java/com/personalsite/models/` and `core/SiteApiClient.kt` together with the iOS models.

## Git and Commits

- Inspect `git status` before editing or staging. Stage only agreed paths; `tools/smaug` is a nested repository and must stay out of outer-repo commits.
- Run `pnpm git:safety` before commits that could touch content or configuration. Do not bypass the pre-push guard or rewrite history without explicit approval.
- Keep commits local unless a push is explicitly requested. Use Chinese Conventional Commit subjects for project changes.
- AI commits include the agent's actual attribution:

  ```text
  Co-Authored-By: <agent model> <noreply@example.com>
  ```

<comet-ambient-resume>
<!-- Managed by Comet. Edits inside this block may be replaced by comet init/update. -->
<!-- Contract: comet.resume_probe.v2 -->

## Comet Ambient Resume

在这个仓库中，开始处理需要改动或调查的任务前，如果可能存在活跃 Comet workflow，把当前用户请求传入只读探针：`comet resume-probe . --stdin --json`。

- 如果用户通过宿主明确调用任意 Comet Skill（例如 `@comet`、`/comet`、`@comet-native` 或 `/comet-hotfix`），显式调用优先于本恢复协议；不要运行 resume probe，直接进入被调用的 Skill。
- 如果用户通过宿主明确调用的是非 Comet 的 Skill 或斜杠命令，任务意图已由该调用明确：不要运行 resume probe，直接执行该 Skill。
- 如果你正在 Comet 流程内（包括正在等待用户回复你在流程中提出的问题），不要运行 resume probe；把这类回复（例如方案/选项选择）当作当前 change 的继续，直接按用户的选择推进。
- 只信任返回的 `workflow`、`skill` 和 `entrySource`；它们只由项目配置或无配置兼容回退决定。不得扫描或切换另一套 workflow。
- 如果 probe 返回 `auto_resume`，简短说明选中的 active change，并进入 `nextCommand` 指向的永久入口。不要把状态命令当作恢复入口直接推进。
- 如果 probe 返回 `ask_user`，只问一个简短问题并等待用户回复。
- 如果当前请求未明确调用 Comet Skill，且 probe 返回 `out_of_scope` 或 `none`，不要进入 Comet workflow。
- `out_of_scope` 或 `none` 只表示不要因为这个新请求进入 Comet workflow；它绝不表示要暂停或退出一个已在进行的 Comet 流程。
- 如果配置或状态无效且没有 `nextCommand`，停止并报告原因；不要猜测另一个 workflow。
- 不能只因为存在 active change 就把无关任务挂到该 change。Native 的未提交改动由 Native 入口检查，不由探针自动归因。
</comet-ambient-resume>
