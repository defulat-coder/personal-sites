# AIHero desktop restoration plan

## Locked direction

- User correction: reproduce the original AIHero desktop design language and page system; remove the custom `CY` / `Personal Index` shell.
- Current viewport scope: desktop only, accepted at `1440×900`. Mobile design and mobile verification are explicitly deferred by the user.
- Source of truth: live captures from `https://www.aihero.dev/` saved as `var/verification/personal-site/latest/source-step-00.png` through `source-step-09.png` and measured at a `1440×900` viewport.
- Content boundary: preserve the reference layout, typography, rules, rhythm, image density, and interactions while rendering only the project's approved public personal content. The user confirmed reproduction authorization, so the exact source mark and source thumbnails may be used; AIHero prose, identity claims, account behavior, and portrait identity remain excluded.

## Captured design system

- Page field: very light neutral gray with a centered white sheet.
- Desktop sheet: `1182px` wide at x `129px` in a `1440px` viewport, with one-pixel vertical edge rules.
- Header: `63px` tall, sticky, white/translucent, compact wordmark, small icon-led navigation, and a single bottom hairline.
- Type: Geist; near-black display copy; compact body copy; headings use tight negative tracking and weights between `600` and `700`.
- Hero: `465px` tall, two columns (`562.85px / 619.15px`), oversized two-line display copy on the left and a full-bleed saturated portrait panel on the right.
- Editorial section: two-column argument block with a vertical center rule and generous `64px` insets.
- Content rows: `217px` high, `240×135` image, large title, summary, circular arrow affordance, and one-pixel row rules.
- Section headings: centered `36px / 45px`, about `80px` vertical padding.
- Closing sections and footer: white grid cells, thin rules, restrained orange-red CTA accent; no black closing plane.
- Shape language: square corners for structural surfaces; circles only for arrow affordances and compact controls.

## Reference-to-build map

| Source region | Measured reference | Local implementation | Preserved behavior |
|---|---:|---|---|
| Desktop frame | x `129`, width `1182` | `.site-frame` | centered bordered sheet |
| Sticky header | y `0`, height `63` | `SiteHeader` | section links, GitHub/Yuque links, sticky scroll state |
| Hero | y `63`, height `465.36`; columns `562.85 / 619.15` | `.hero` | left display copy + public-avatar-derived hero image |
| Positioning statement | y `528.36`, height `616`; two columns | `.positioning` | approved identity summary only |
| Project / knowledge heading | centered `36px / 45px` | `.section-heading` | same typographic role and whitespace |
| Editorial rows | `217px` per item; image `240×135` | `EditorialRow` | hover lift, arrow movement, external link only where approved |
| Practice grid | three-column source card rhythm adapted to six indexed Agent projects | `.practice-grid` | border grid and concise titles |
| About | two-column portrait + biography | `.about` | public GitHub avatar and approved identity copy |
| Footer | white grid cells and bottom utility row | `SiteFooter` | section links, GitHub, Yuque, back to top |

## Public-content map

- Hero identity: `identity-profile`, synthesized from the complete OKF index catalog.
- Featured rows: `project-mx-agent`, `project-health-pilot`, `project-ddd-hr`, and `project-agno-cookbook-cn` from the GitHub owned-project index.
- Knowledge grid: `knowledge-aigc`, `knowledge-product`, `knowledge-tools`, and `knowledge-learning` from Yuque repository/document indexes.
- Practice grid: six high-activity Agent project entries from the Agent History project index.
- Runtime content source: the sorted catalog of all `knowledge/private/personal/**/index.md` files; no Raw file or individual OKF concept body is read by the public-content generator.
- External destinations: the repository-registered public GitHub profile and the approved Yuque URL only.
- No newsletter form, login flow, third-party testimonial, client-logo strip, or unsupported metric will be invented.

## Asset decision manifest

| Asset | Role | Decision | Source / constraint | Final path |
|---|---|---|---|---|
| Hero portrait | full-bleed hero visual | one retained generated raster | project-registered public GitHub avatar is the identity anchor; live AIHero capture is the composition and palette reference | `public/images/hero-portrait.png` |
| About portrait | biography visual | public identity asset | repository-registered public GitHub avatar; no generated alternative | `public/images/avatar-source.png` |
| Editorial thumbnails | four `240×135` row images | authorized source assets | exact source thumbnails retained to preserve the original image density and crop behavior | `public/images/source/row-01.webp` through `row-04.webp` |
| Career grid thumbnails | six `16:9` grid images | authorized source assets | exact source thumbnails retained to preserve the original three-column card system | `public/images/source/grid-01.webp` through `grid-06.webp` |
| Header mark | identity mark | authorized source asset | exact source mark extracted from the live page after the user confirmed reproduction authorization; paired with the user's name, not the source wordmark | `public/images/aihero-mark-authorized.svg` |
| Navigation and row icons | navigation / affordance | icon library | use the closest Lucide icons; no handcrafted SVGs | `components/site-header.tsx`, `components/editorial-row.tsx` |
| Structural frame, rules, spacing | design system | code-native | measured CSS only; no screenshot clipping or CSS artwork | `app/globals.css` |

### Final retained ImageGen prompt

The retained Hero uses the public GitHub avatar as its identity source and the live `1440×900` source capture as its composition reference. Its final composition edit was:

> Preserve the same illustrated character, warm abstract background, palette, texture, lighting, and full-bleed 1536×1024 canvas. Keep the reduced subject scale, then translate the character horizontally so the face center lands at 52% of the canvas width. Do not add text, logos, frames, or new objects.

Only `public/images/hero-portrait.png` remains in the build. Earlier composition drafts and the four generated thumbnail drafts were removed after authorization allowed exact source thumbnails.

## Acceptance contract

- Compare the live source and local page at exactly `1440×900` and the same scroll state.
- The first viewport must preserve frame x/width, header height, hero height/column split, first editorial split, typography hierarchy, hairline rules, white field, and saturated image panel.
- Desktop navigation and external links must be keyboard accessible; skip link and section anchors must work.
- No mobile layout or mobile screenshot is part of this correction pass.
- Save a combined side-by-side source/local comparison and complete `design-qa.md`; final result may be `passed` only after all P0/P1/P2 visible mismatches are fixed.
