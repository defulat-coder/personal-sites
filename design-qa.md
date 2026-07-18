# Desktop design QA

## Result

**Final result: passed**

Scope is intentionally limited to the desktop implementation at `1440×900`. Mobile layout and mobile QA were explicitly deferred by the user.

## Comparison set

- Live reference: `https://www.aihero.dev/`
- Reference viewport: `1440×900`, top of page and representative editorial-row state
- Local implementation: `http://127.0.0.1:3000/`
- First-viewport comparison: `var/verification/personal-site/latest/desktop-side-by-side-final.jpg`
- Editorial-system comparison: `var/verification/personal-site/latest/desktop-components-side-by-side-final.jpg`
- Source scroll captures: `var/verification/personal-site/latest/source-step-00.png` through `source-step-09.png`
- Local scroll captures: `var/verification/personal-site/latest/local-step-00.jpg` through `local-step-06.jpg`

## Measured parity

| Element | Reference | Local | Status |
|---|---:|---:|---|
| Centered sheet | x `129`, width `1182` | x `129`, width `1182` | exact |
| Sticky header | height `63` | height `63` | exact |
| Hero | y `63`, height `465.36` | y `63`, height `465.36` | exact |
| Hero columns | `562.85 / 619.15` | `562.85 / 619.15` | exact |
| Positioning section | two-column, `616px` high | two-column, `616px` high | exact system geometry |
| Editorial image slot | `240×135` | `240×135` | exact |
| Editorial row | `217px` rhythm | `217px` rhythm | exact |
| Grid | three columns, one-pixel rules | three columns, one-pixel rules | exact system geometry |
| Horizontal overflow | none at `1440px` | none; document width `1440` | passed |

## Findings and corrections

### P0

No open P0 issues.

### P1

- The earlier custom dark/product-index shell did not match the reference. It was removed and replaced with the measured AIHero desktop frame, header, hero, editorial rows, grid, about section, and white grid footer.
- A two-pixel frame drift caused by structural borders was fixed by moving the vertical rules to non-sizing pseudo-elements. The reference and local frame now both resolve to x `129`, width `1182`.
- Generated project-card art diverged from the authorized reference's image language. The build now uses the exact authorized source thumbnails for editorial rows and the three-column grid.

No open P1 issues.

### P2

- The Hero character was initially oversized and right-heavy. The retained identity illustration was reduced and repositioned to match the source's breathing room and subject balance.
- Unused Hero drafts and four unused generated thumbnail drafts were removed; the build retains one Hero image only.
- Chinese copy produces different line breaks from the English reference, but font size, line height, column width, rules, and vertical rhythm remain aligned. This is an intentional content adaptation rather than a design-system mismatch.

No open P2 issues.

### P3 / deferred

- Mobile behavior is not implemented or evaluated in this pass, per the user's desktop-only instruction.
- The local page is shorter than the reference because it renders only approved public personal content and omits unsupported source newsletter, login, testimonial, and logo-strip content.

## Functional QA

- All 14 images load with non-zero intrinsic dimensions.
- No browser console errors were observed.
- All internal section targets exist.
- `#projects`, `#knowledge`, `#practice`, and `#about` land at approximately `63px`, directly below the sticky header.
- The header remains at top `0` for all verified anchor states.
- GitHub and Yuque links resolve to the approved public URLs and open in a new tab with `rel="noreferrer"`.
- Heading hierarchy contains one `h1` followed by section `h2` elements.
- The skip link points to the focusable main content target.
