# Personal knowledge system architecture

## Product direction

- The site is a clickable personal knowledge system with a concise identity-led homepage, not a static personal-profile landing page.
- The public OKF projection remains the only runtime content source. Private Raw files, credentials, contact details, and unreviewed source bodies never enter the web build.
- GitHub and Yuque remain the only external destinations and appear only in the top-right header group.
- The visual language keeps the authorized reference system's white paper, hairline rules, compact typography, black text, and restrained orange accent, but the page composition is now an application workspace.

## Homepage content recomposition — 2026-07-19

### Build contract

- Builder: the installed `frontend-skill`; the optional `identity-skill` embedded frontend-builder and asset-splitter references are not present in this checkout.
- Scope: desktop homepage content and layout only. The shared header, footer, routes, public/private boundary, typography family, white editorial sheet, hairline rules, and orange accent stay intact.
- Reference: the existing authorized desktop template remains the visual frame. Its content composition is no longer treated as a source of truth.

### Visual thesis

A precise white editorial index crossed by one orange career trace: technical, personal, dense enough to reward reading, but never presented as a dashboard or a collage of cards.

### Content plan

1. Hero — identify Chen Yuan, state that the path did not begin with AI, and show the four-stage engineering trajectory as the dominant visual.
2. Career support — explain the continuous move from business systems to architecture, organization effectiveness, and Agent engineering.
3. Project evidence — keep four indexed projects as proof, using the existing editorial rows and approved thumbnails.
4. Knowledge depth — replace generic legacy themes with the semantic OKF domains and direct library routes.
5. Practice and principles — use a text-first Agent practice index plus the operating principles: context, tools, boundaries, evidence, evaluation, and recovery.
6. Final invitation — explain that the site is a readable knowledge system, then route to knowledge and system notes.

### Interaction thesis

- A short staggered entrance gives the hero title and trajectory enough presence without making the page theatrical.
- Career and knowledge rows reveal the orange trace and move their directional affordance on hover/focus.
- Editorial project rows retain their existing image crop and restrained color reveal; no carousel or decorative motion is added.

### Reference-to-build map

| Region | Code layer | Background asset | Foreground asset | Preserved anchor | Deliberate change |
|---|---|---|---|---|---|
| Header | Existing `SiteHeader` | None, code-native | Existing authorized mark | 63px sticky shell and top-right public links | None |
| Hero | Name, thesis, CTA, four-stage trajectory | None, code-native | None | Existing desktop height and column split | Generated portrait removed; career trajectory becomes the visual anchor |
| Positioning | One continuous engineering thesis plus three internal paths | None, code-native | None | Existing split section and center rule | Repetitive collection marketing copy replaced by identity-led content |
| Career path | Four chronological stages | None, code-native | None | Hairline grid and orange accent | New content-derived section |
| Projects | Existing linked editorial rows | Existing white sheet | Four retained approved project thumbnails | Row rhythm and hover | Heading reframed as evidence rather than a gallery |
| Knowledge | Semantic domain names, descriptions, counts, and routes | None, code-native | None | Indexed grid and monospace labels | Legacy four-topic cards replaced by current OKF taxonomy |
| Practice | Text-first indexed links | None, code-native | None | Border rhythm | Six decorative practice images removed |
| Principles | Six parallel operating constraints | Orange code-native field | None | Strong closing color anchor | Generic slogan replaced by explicit Agent engineering position |
| Final CTA | Knowledge-system explanation and internal links | None, code-native | None | Calm white closing section | Duplicate portrait/about block removed |

### Asset decision manifest

| Asset | Status | Decision |
|---|---|---|
| Header mark | `ready` | Retain the existing authorized SVG. |
| Project thumbnails | `ready` | Retain the four existing approved thumbnails because they identify real project records. |
| Hero portrait | `not-used` | Remove from the homepage; the career trace carries the visual hierarchy. |
| Practice thumbnails | `not-used` | Remove from the homepage; practice is presented as readable evidence. |
| About portrait | `not-used` | Remove from the homepage to avoid repeating the identity section. |
| New generated imagery | `not-required` | No image generation or collection is authorized or needed for this pass. |

### Acceptance additions

- A first-time visitor can scan only the headings and understand the progression: business systems → group architecture → organization effectiveness → Agent engineering.
- The first viewport contains one thesis, two internal actions, and one four-stage trajectory; it contains no portrait card, statistic strip, or floating dashboard.
- Knowledge links point to the semantic OKF library routes instead of sending every topic to the collection root.
- The homepage uses no practice or biography images and keeps no duplicated identity/CTA section.
- Existing public content claims remain rendered somewhere in the internal site, and the homepage keeps the approved identity summary attached to `identity-profile`.

## Information architecture

| Surface | Route shape | Purpose |
|---|---|---|
| Homepage | `/` | Introduce Chen Yuan, establish the Agent-engineering focus, and route readers into the three internal collections |
| Knowledge workspace | `/knowledge` | Search and filter the content-derived OKF taxonomy: 9 semantic domains plus a governed review library, local full text, and 60 approved public entries |
| Knowledge library | `/knowledge/[library]` | Read one library summary and browse all entries in that library |
| Knowledge entry | `/knowledge/[library]/[entry]` | Read one public index note with breadcrumbs, context, and adjacent navigation |
| Project library | `/projects` and `/projects/[project]` | Browse four public project records and open each record in site |
| Practice log | `/practice` and `/practice/[practice]` | Browse six Agent practice records and open each record in site |
| System description | `/about` | Explain the knowledge model, reading surfaces, and public/private boundary |

The root route renders the approved editorial homepage. The production build generates 87 static pages across the homepage, indexes, 10 knowledge-library routes, 60 public note routes, four project routes, and six practice routes.

## Interaction model

- Search matches library names, note titles, and note summaries at entry level.
- Library filters update the visible note list without leaving the workspace.
- Every library, note, project, and practice record is a real internal link.
- Knowledge pages keep orientation through persistent navigation, active library state, breadcrumbs, reading context, and previous/next links.
- At narrow preview widths the three-column workspace collapses into a readable single-column flow without horizontal overflow.

## Acceptance contract

- All semantic domains, governed local concepts, and 60 approved public notes must have stable internal routes.
- All 4 project records and 6 practice records must have stable internal detail routes.
- Search for `RAG` must return the `Agno 与 RAG` entry rather than the whole AIGC library.
- Production browser checks must report zero broken internal links, failed requests, console errors, accessibility violations/incomplete checks, and horizontal overflow.
- Every approved public projection title, summary, and detail claim must remain visible in a production DOM surface.
