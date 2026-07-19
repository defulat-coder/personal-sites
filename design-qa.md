# Desktop design QA

## Result

**Final result: passed**

Current OKF-index site verified at `1440×900` on run `2026-07-19T01-30-36-199Z`. Mobile implementation and acceptance remain explicitly deferred.

## Current comparison set

- Authorized live reference: `https://www.aihero.dev/`
- Local implementation: `http://127.0.0.1:3000/`
- Reference capture: `var/verification/personal-site/latest/reference-desktop-1440x900.png`
- Local capture: `var/verification/personal-site/latest/local-desktop-1440x900.png`
- Reference baseline: `5ece031dd08fefeec9ee3424f4b947096bd6391197fc70a8195af6723c1f2cb3`
- Local homepage screenshot: `75b86bc96ffa340b17502cac5919ae5001239390224453d6edc93442390d34e6`
- Route captures: `quick-projects-full-desktop-1440x900.png`, `quick-knowledge-full-desktop-1440x900.png`, `quick-practice-full-desktop-1440x900.png`, and `quick-about-full-desktop-1440x900.png`

## Measured parity

| Element | Reference | Local | Status |
|---|---:|---:|---|
| Centered sheet | x `129`, width `1182` | x `129`, width `1182` | exact |
| Sticky header | height `63` | height `63` | exact |
| Hero | y `63`, height `465.36` | y `63`, height `465.36` | exact |
| Hero columns | `562.85 / 619.15` | `562.84 / 619.14` | within tolerance |
| Positioning section | two-column, `616px` high | two-column, `616px` high | exact system geometry |
| Maximum normalized delta | — | `0.00000543` | passed, limit `0.05` |
| Horizontal overflow | none | none | passed |

## Current content checks

- All `127` OKF `index.md` files are included in the source catalog; no Raw file is read by the public generator.
- The public projection contains `18` published items, `0` exclusions, `0` silent drops, and `36` field-level rendered claims.
- Every claim is bound to explicit index-file paths and is checked in the production DOM by `data-content-id`.
- `/projects`, `/knowledge`, `/practice`, and `/about` each render a dedicated page, matching active navigation state, verified metrics, and the corresponding indexed content set.
- Privacy, confidentiality, secret, unsupported-claim, private-reference, console, request, link, Axe violation, unresolved Axe check, overflow, and layout-shift findings are all zero.

## Findings and corrections

### P0

No open P0 issues.

### P1

- The full-index catalog formerly validated evidence against one concatenated string. Each title, summary, and URL is now bound to named `index.md` files and field-specific evidence hashes.
- Content verification formerly inferred rendering from source-code IDs. It now verifies every approved field against the production DOM.
- The reference baseline formerly mixed desktop and deferred mobile captures. It now contains only the approved desktop viewport and can reuse that exact capture deterministically.
- The visual QA evidence was regenerated after the 18-item OKF-index page update.
- The old hash-only header navigation was replaced by four real static routes. Each route is exercised through the production browser and captured as a full-page desktop screenshot.
- Accessibility verification now runs on the homepage and every content route, records both Axe violations and unresolved checks, and fails on either category.
- Project, knowledge, practice, and about content now renders as inline OKF text; GitHub and Yuque remain the only external links and appear only in the header.

No open P1 issues.

### P2

- The measured AIHero desktop frame, rules, hero split, editorial rows, grid, and colored navigation icon treatment are retained while all page copy comes from the current public OKF projection.
- Chinese copy intentionally wraps differently from the English reference; the geometry and visual system remain aligned.

No open P2 issues.

### Deferred

- Mobile behavior is not implemented or evaluated in this pass, per the user's desktop-only instruction.

## Functional QA

- All 14 rendered images load with non-zero intrinsic dimensions.
- `/projects`, `/knowledge`, `/practice`, and `/about` return static pages with the expected `h1`, active navigation state, and indexed content.
- Each route starts at scroll position `0`, has no horizontal overflow, and can continue to the next content page.
- GitHub and Yuque use approved public URLs, open with `rel="noreferrer"`, and are absent from the main content and footer.
- The page has one `h1`, ordered section headings, and a focusable skip-link target.
