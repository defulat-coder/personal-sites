# 008 — Make the signal field display-aware

- **Status**: DONE
- **Commit**: a7d4980
- **Severity**: LOW
- **Category**: Performance and accessibility
- **Estimated scope**: 3 files, about 120 lines

## Problem

`ios/PersonalSite/Features/Home/SignalFieldView.swift:35-49` recomputes every term’s progress, opacity, and offset at a fixed 30fps:

```swift
TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: startDate == nil)) { context in
    ...
    ForEach(...) { ... .opacity(...).offset(...) }
}
```

Thirty frames per second can strobe on high-refresh displays, while the timeline continues whenever the view remains mounted. The existing reduced-motion static grid is good and must be preserved.

## Target

- Use display-aware animation cadence while visible and active.
- Pause when the scene is inactive, when the Home surface disappears, or when the signal field is outside the visible scroll region.
- Continue animating only transform/offset and opacity; preserve linear marquee velocity.
- Preserve the static grid for Reduce Motion.

## Repo conventions to follow

- Keep `SignalFieldTerms` deterministic and keep its existing unit tests.
- Keep the dot-grid Canvas and current visual tokens.
- Use native SwiftUI; no CADisplayLink wrapper unless profiling proves `TimelineView` inadequate.

## Steps

1. Inject `scenePhase` and track field visibility with `onGeometryChange` against the scroll/container bounds.
2. Set `TimelineView` paused unless scene phase is active, Reduce Motion is false, and the field intersects the visible viewport.
3. Replace the hard 30fps minimum interval with display-aware `.animation` cadence. If energy profiling shows excessive work, select an explicit cadence only after measuring 30/60fps hitch and energy results.
4. Hoist track metadata that does not depend on elapsed time out of the per-frame closure.
5. If profiling still shows high main-thread cost, draw pills in fewer layers or cache layout measurements; do not rewrite the feature speculatively.
6. Add tests for pause-state decisions and retain all `SignalFieldTermsTests`.

## Boundaries

- Do not change term selection, positions, speeds, copy, dot spacing, or dark-mode inversion.
- Do not add bounce, acceleration, parallax, or gesture interaction.
- Do not remove the reduced-motion static presentation.

## Verification

- **Mechanical**: all SignalField tests and the full suite pass.
- **Feel check**: inspect on iPhone 17 Pro at normal speed and slow motion; travel must be linear with no visible step every other frame. Scroll the field completely offscreen and background the app, then confirm updates pause using SwiftUI Instruments or `_logChanges()` in a temporary debug build.
- **Done when**: the marquee is smooth while visible and consumes no continuous animation work while inactive/offscreen.
