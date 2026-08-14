<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Instructions

## Runtime and Checks

- Use `pnpm` with Node.js `>=22.19.0`; the package manager is pinned in `package.json`.
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
- Treat `curation:*`, `github:starred:*`, `ai-news:sync`, and `supabase:push` as external data operations. Follow `docs/supabase-x-sync.md`, `docs/github-starred-sync.md`, and `docs/ai-news-sync.md`; use `pnpm supabase:push -- --dry-run` before a database write. Run daily Star syncs one at a time and report partial results until the process exits. `ai-news:sync` runs on GitHub Actions hourly (`.github/workflows/ai-news-sync.yml`; launchd on this machine is an optional fallback); the site only reads the `ai_news_public_items` projection.

## Git and Commits

- Inspect `git status` before editing or staging. Stage only agreed paths; `tools/smaug` is a nested repository and must stay out of outer-repo commits.
- Run `pnpm git:safety` before commits that could touch content or configuration. Do not bypass the pre-push guard or rewrite history without explicit approval.
- Keep commits local unless a push is explicitly requested. Use Chinese Conventional Commit subjects for project changes.
- AI commits include the agent's actual attribution:

  ```text
  Co-Authored-By: <agent model> <noreply@example.com>
  ```
