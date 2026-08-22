# 002 — Rebuild the profile and section transition

- **Status**: DONE
- **Commit**: a7d4980
- **Severity**: HIGH
- **Category**: Physicality and interruptibility
- **Estimated scope**: 4 files, about 180 lines

## Problem

`ios/PersonalSite/App/PersonalSiteApp.swift:27-49` removes one complete screen tree and inserts another:

```swift
if section == .home {
    HomeView(...)
        .transition(homeTransition)
} else {
    VStack(spacing: 0) {
        SiteHeaderView(...)
        sectionContent
    }
    .transition(sectionTransition)
}
```

The transitions in lines 75-86 move and fade the whole screen. A 30fps Simulator recording showed a double-exposed large and compact header followed by a size jump. The header has no persistent visual identity, and the fixed timing curve does not preserve velocity when a second tab is tapped during the first transition.

## Target

- The profile avatar, identity summary, theme button, and selected-section indicator must have synchronized geometry across expanded and compact headers.
- Only those header elements morph with `PSMotion.profile` (`.spring(duration: 0.32, bounce: 0)`).
- Section content enters with `PSMotion.stateChange`, opacity from 0 to 1 and at most 12pt directional offset; outgoing content leaves on the symmetric path.
- Reduced Motion removes all positional movement and uses only `PSMotion.stateChange` opacity.
- Repeated taps retarget the current animation; never disable buttons during motion.

## Repo conventions to follow

- Preserve the expanded home header dimensions in `HomeView.swift` and compact dimensions in `SiteHeaderView.swift`.
- Preserve home profile scrolling behavior; do not make the expanded profile sticky.
- Continue using native `NavigationStack` transitions inside each section.
- Reuse `PSMotion` from plan 001.

## Steps

1. Extract shared avatar, identity text, external links, and theme button markup into `ProfileHeaderContent` in `SiteHeaderView.swift`; expose `mode: .expanded | .compact` without duplicating semantic content.
2. Introduce a dedicated `@Namespace` for profile geometry. Give avatar, identity summary, theme button, and active indicator stable IDs. Keep outgoing and incoming endpoints alive in one `ZStack` for the duration of the transition; do not apply opacity to the matched elements themselves.
3. Split `HomeView` into profile/header material and `HomeBodyView` so the content transition does not animate the full page or force the profile to become sticky.
4. Replace `homeTransition` and `sectionTransition` with a direction-aware content-only transition using 12pt offset plus opacity and `PSMotion.stateChange`.
5. Change `selectSection` to use `PSMotion.profile` for the profile mode change. When Reduce Motion is enabled, perform the geometry change without movement and retain a 200ms opacity change for content.
6. Add an iOS test or pure state test for section ordering/direction if direction is extracted into a helper.

## Boundaries

- Do not change header sizes, labels, section order, data models, or screen routing.
- Do not add a global animation modifier to the root view.
- Do not animate list rows or native push/pop navigation.
- If synchronized geometry still double-exposes at 10% playback speed, stop; do not hide it with a long blur or larger fade.

## Verification

- **Mechanical**: build and run on iPhone 17 Pro; all tests pass.
- **Feel check**: record at 30fps and inspect frame-by-frame in both directions. Avatar size and position must interpolate across several frames; no frame may contain two fully readable identity summaries. Rapidly tap Home → Daily → Home and confirm the spring retargets from its visible position.
- Toggle Reduce Motion and confirm position changes disappear while a 200ms content fade remains.
- **Done when**: the header reads as one object changing configuration, not two screens crossfading.
