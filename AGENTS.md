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
- Verify UI changes in the running Next app with ego lite (the ego-browser skill): inspect compiler issues, routes, browser errors, and the rendered interaction in a real page.

## Browser Verification and Debugging

- Use ego lite for all agent-driven browser work — opening URLs, verifying UI, clicking through flows. Run everything through `ego-browser nodejs <<'EOF' ... EOF` heredocs; follow the ego-browser skill for task spaces, snapshots, and helpers.
- Debug through ego lite CDP: `cdp(...)` for protocol-level needs (console messages, network, dialogs), `js(...)` for in-page state and DOM inspection. Collect browser errors this way instead of guessing from screenshots.
- The Playwright suite in `e2e/` remains the automated regression path; do not rewrite specs as ego lite scripts.

## Data, Privacy, and Caching

- Read `docs/sensitive-data.md` before touching curation inputs or credentials. Never stage, publish, render, screenshot, or expose `data/sensitive/`, `knowledge/sensitive/`, local credentials, or `tools/smaug/.state/`.
- The public site reads only Supabase public projections; never add a fallback from browser or runtime code to sensitive local data. Service-role keys never belong in `NEXT_PUBLIC_*` variables.
- Keep public curation detail reads cacheable with ISR (`revalidate = 300`) and loading states. For cache changes, verify production route classification and `x-nextjs-cache` MISS then HIT behavior.
- Treat `curation:*`, `github:starred:*`, `ai-news:sync`, and `supabase:push` as external data operations. Follow `docs/supabase-x-sync.md`, `docs/github-starred-sync.md`, and `docs/ai-news-sync.md`; use `pnpm supabase:push -- --dry-run` before a database write. Run daily Star syncs one at a time and report partial results until the process exits. Supabase Cron calls `/api/cron/ai-news` every 5 minutes; GitHub Actions only runs the daily backfill or manual recovery. The site only reads the `ai_news_public_items` projection.

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
