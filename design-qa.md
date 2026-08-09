# Personal knowledge system QA

## Result

**Current result: passed**

The public knowledge system includes an identity-led editorial homepage plus the application workspace. The homepage was verified in development at `1440×900` on 2026-07-19; the full production system retains the prior `1440×900` and `642×863` verification baseline.

## Verified structure

- One real homepage with Chen Yuan's approved introduction, the authorized portrait treatment, and internal entrances to knowledge, projects, practice, and system information.
- 10 clickable knowledge libraries: nine semantic domains and one governed review library.
- 60 clickable knowledge-note routes.
- 4 clickable project-detail routes.
- 6 clickable practice-detail routes.
- 87 generated static pages in the production build.
- 29 approved public projection records and 74 rendered field-level claims.

## Functional checks

- `/` shows the identity summary in the first viewport; its brand mark returns home, and its collection links navigate to real internal routes.
- `/knowledge` exposes one searchbox, 10 library links, and 60 public note routes; local full-text mode additionally exposes the complete classified concept set.
- Searching `RAG` returns the specific `Agno 与 RAG` note.
- `/knowledge/learning` exposes six notes and marks `学习 📚` as the active library.
- `/knowledge/learning/note-01` renders breadcrumbs, the public summary, library context, and adjacent-note navigation.
- `/projects` exposes four internal project routes; `/practice` exposes six internal practice routes.
- GitHub and Yuque are the only external links and remain inside the header.

## Runtime checks

- Homepage development browser check at `1440×900`: no horizontal overflow, no broken first-viewport image, zero console/runtime errors, and successful navigation from `/` to `/knowledge`.
- Production build: passed, 87 generated static pages.
- Component and route-model tests: passed.
- TypeScript and ESLint: passed.
- Public-content and privacy-boundary verification: passed.
- Production browser verification: zero broken internal links, failed requests, console errors, content-rendering failures, accessibility findings, layout shift, or horizontal overflow.
- Real `642×863` preview: zero horizontal overflow on project, knowledge, library, and note pages.

## Public boundary

Only approved OKF index titles, summaries, and detail projections are rendered. Private Raw documents and sensitive source fields remain outside the public build.

---

# Opening loader QA · 2026-08-09

## Comparison target

- Source visual truth: `/tmp/ample-studio-loaded.png` — captured from `https://www.ample.studio/` during the two-cell charging state.
- Implementation: `/tmp/personal-sites-loader-two-cells.png` — captured from `http://127.0.0.1:7100/` in the same state.
- Combined full-view evidence: `/tmp/ample-loader-comparison.png` (source left, implementation right).
- Viewport: `1200 × 818` CSS px at device-pixel-ratio `2`; both source and implementation captures are `2400 × 1636` px, so no density normalization was needed.
- State: full-screen white overlay; two green battery cells visible; illustrated character centered below the battery.

## Findings

- No actionable P0, P1, or P2 differences. The loader uses the locally stored source illustration, matching the source crop, white background, centered geometry, five-cell charge cadence, and upward reveal.
- [P3] The development-only Next.js indicator can appear above the overlay in local screenshots. It is not part of the app and is absent from the production build.

## Fidelity surfaces

- Fonts and copy: the loading state contains no visible product copy; its screen-reader label is localized as `正在加载陈远知识库`.
- Spacing and layout rhythm: the illustration and battery use the captured `clamp(132px, 16vw, 180px)` visual scale and centered placement.
- Colors and tokens: white overlay, near-black battery outline, and green battery gradient match the reference state.
- Image quality and asset fidelity: the source loader SVG is stored locally at `public/images/ample-loader-sequence.svg`; no hotlinked asset or CSS-drawn illustration is used.
- Reduced motion: tested with `prefers-reduced-motion: reduce`; the main page becomes available within 400 ms.

## Interaction and runtime checks

- Full initial navigation displays the loader, prevents page scrolling while active, and reveals the already-rendered page after the final charge state.
- Browser capture confirmed the complete state at `/` and the development server reported zero configuration, session, or compilation errors.
- `pnpm typecheck`, targeted ESLint, and `pnpm build` passed; the production build generated 93 static pages.

## Comparison history

- Initial QA pass: no P0/P1/P2 findings, so no visual correction iteration was required.

## Implementation checklist

- [x] Add a root-layout client loader without turning the page tree into a Client Component.
- [x] Store the referenced SVG locally and avoid source-asset hotlinking.
- [x] Implement charging, reveal, scroll lock, and reduced-motion behavior.
- [x] Verify desktop, mobile, and reduced-motion runtime states.

final result: passed

---

# Reference palette restoration QA · 2026-08-09

## Final direction

- The whole site now follows the referenced Ample visual language: white surfaces, near-black ink, neutral-gray dividers and surfaces, without the former orange/cream theme.
- The homepage retains the curation-only layout. Its two external links now include a Git branch icon for GitHub and an open-book icon for 语雀.

## Verification

- Live implementation: `http://127.0.0.1:7100/`; browser inspection confirmed white `rgb(255, 255, 255)` background, near-black `rgb(28, 28, 30)` ink, and two visible link icons.
- `pnpm typecheck`, targeted ESLint, and `pnpm build` passed; the production build generated 93 static pages.

final result: passed

---

# Warm palette correction QA · 2026-08-09

## Direction

- The desktop composition remains the requested Ample-inspired left rail, rounded feed control, and right curation gallery.
- Per the final visual direction, the personal site's original orange and cream palette takes precedence over the reference site's neutral palette.

## Verification

- Implementation capture: `/tmp/personal-sites-curation-warm-final.png` from `http://127.0.0.1:7100/`, after the opening loader completed.
- The homepage now uses the original warm background and field tokens, cream profile and tab surfaces, orange active tab and feature-card border, and orange/cream tag accents.
- The same warm token family is restored for the existing editorial gradient, about media surface, and knowledge-workspace controls; daily-curation detail routes keep their original workspace presentation.
- `pnpm typecheck`, targeted ESLint, and `pnpm build` passed after the correction. The production build generated 93 static pages.

## Result

- No P0, P1, or P2 issues found. The layout adaptation is intact while the user-preferred visual identity is restored.

final result: passed

---

# Daily curation homepage QA · 2026-08-09

## Comparison target

- Source visual truth: `/tmp/ample-studio-after-1_5s.png` from `https://www.ample.studio/` after its loader completed.
- Implementation: `/tmp/personal-sites-curation-warm-final.png` from `http://127.0.0.1:7100/` after the opening loader completed.
- Full-view comparison: `/tmp/ample-curation-layout-final-comparison.png` (source left, implementation right).
- Viewport: `1200 × 818` CSS px at device-pixel-ratio `2`; both captures are `2400 × 1636` px, so no density normalization was needed.
- State: desktop homepage, default light theme, first curation card visible.

## Findings

- No actionable P0, P1, or P2 differences for the requested adaptation. The source's fixed left profile rail, centered rounded tab control, and gallery-style right content column are present; the color palette intentionally follows the user's personal-site direction.
- The source's portfolio media is intentionally replaced with the user-requested daily-curation cards. No unrelated homepage content remains.
- [P3] The development-only Next.js control appears over some local captures; it is external to the app and not emitted by the production build.

## Fidelity surfaces

- Fonts and typography: the existing system sans stack is retained; the oversized left heading, compact monospaced metadata, and medium-weight card titles match the reference hierarchy.
- Spacing and layout rhythm: a fixed left rail and spacious right gallery replace the prior stacked editorial homepage; two-column lower cards preserve the reference density.
- Colors and tokens: global site and workspace tokens use the original warm family: orange interaction accents, cream fields and tab surfaces, a warm editorial gradient, and soft beige dividers.
- Image quality and asset fidelity: the profile uses the existing authorized site mark. The cards use no placeholder or fabricated imagery; their text-only treatment is intentional because the preserved curation records are the requested content.
- Copy and content: only daily-curation metadata, summaries, tags, and detail links remain on the homepage.

## Interaction and runtime checks

- All five visible cards navigate to their existing `/curation/[id]` detail route; the first route was opened and returned to `/` successfully.
- The opening loader remains active on full navigation, then reveals the redesigned homepage.
- Browser inspection reported zero console errors; Next.js MCP reported zero configuration, session, or compilation errors.
- `pnpm typecheck`, targeted ESLint, and `pnpm build` passed. The production build generated 93 static pages.

## Comparison history

- Pass 1: the reference composition was applied to the curation-only homepage.
- Pass 2: the user requested the original orange/cream design system be retained, so the neutral reference palette was replaced with the personal site's warm tokens; no P0/P1/P2 differences remain.

## Implementation checklist

- [x] Replace the stacked homepage with a left profile rail and right daily-curation gallery.
- [x] Remove old homepage content sections and navigation chrome.
- [x] Preserve existing curation records and detail links.
- [x] Apply the original orange/cream site palette to the new homepage and existing UI tokens.
- [x] Verify runtime, navigation, and production build.

final result: passed

---

# Final palette direction · 2026-08-09

- Supersedes the warm-palette history above: the user selected `https://www.ample.studio/` as the complete visual reference, including global color treatment.
- The current homepage and workspace tokens use the reference's white, near-black, and neutral-gray palette; the GitHub and 语雀 links each include a visible icon.
- Browser and production-build verification passed.

final result: passed

---

# Ample-reference stream rebuild QA · 2026-08-09

## Comparison target

- Source visual truth: `/tmp/ample-current-reference.png` captured from `https://www.ample.studio/`.
- Implementation: `/tmp/personal-sites-ample-stream-final.png` captured from `http://127.0.0.1:7100/` after the opening loader completed.
- Combined comparison: `/tmp/ample-stream-comparison.png` (source left, implementation right).
- Viewport: `1280 × 720` CSS px for both captures; both are `1280 × 720` px, with no density normalization required.

## Findings and resolved differences

- [Resolved P1] The earlier homepage retained a card gallery and section-title left rail. It was replaced with the source's profile hierarchy: copied reference avatar, name/handle, two external links, interactive dot field, and personal-introduction block.
- [Resolved P1] The earlier right column used large cards. It is now a border-separated vertical curation stream; the real curation titles, authors, summaries, and detail links replace the reference portfolio media as explicitly requested.
- [Resolved P2] The source's moon/sun control is functional on the implementation; both its dark theme and the dot field's pointer interaction were exercised in the browser.

## Fidelity surfaces

- Fonts and typography: compact sans hierarchy, small muted metadata, and heavier stream titles follow the reference's reading order; Chinese copy replaces only app-specific text.
- Spacing and layout rhythm: the reference's approximately 38% left profile column, broad gutter, top-aligned right content, and consistent horizontal dividers are preserved.
- Colors and visual tokens: both pages use white surfaces, near-black primary text, and neutral-gray separators; the implementation also supports the source-style dark-toggle state.
- Image quality and asset fidelity: `public/images/ample-avatar.png` is the source avatar copied at its native 210 px resolution and displayed at the measured 105 px slot.
- Copy and content: personal bio and daily-curation stream use this project's public, verified content instead of the reference's identity and portfolio copy.

## Runtime checks

- The dot field responds to pointer input, and the theme control changes from `rgb(255, 255, 255)` to `rgb(24, 24, 24)` and back.
- The first stream row navigates to `/curation/2085682703299436804` and returns to `/` successfully.
- `pnpm typecheck`, targeted ESLint, and `pnpm build` passed; the production build generated 93 static pages.

## Result

- No actionable P0, P1, or P2 differences remain after accounting for the user-required substitution of project curation rows for the reference's portfolio media.

final result: passed
