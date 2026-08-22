# 001 — Establish native motion tokens

- **Status**: DONE
- **Commit**: a7d4980
- **Severity**: MEDIUM
- **Category**: Cohesion and tokens
- **Estimated scope**: 2 files, about 60 lines

## Problem

Motion values are currently handwritten at call sites. The top-level section change uses a custom curve and two durations in `ios/PersonalSite/App/PersonalSiteApp.swift:69`:

```swift
let duration = destination == .home ? 0.32 : 0.28
withAnimation(.timingCurve(0.16, 1, 0.3, 1, duration: duration)) {
    section = destination
}
```

`AskView` uses an unqualified default animation, while the loader implements its own cubic-bezier evaluator. This prevents the app from having one calm, native motion personality.

## Target

Add `ios/PersonalSite/Core/Motion.swift` with a small namespace. Use exact values:

```swift
import SwiftUI

enum PSMotion {
    static let press = Animation.easeOut(duration: 0.16)
    static let stateChange = Animation.easeOut(duration: 0.20)
    static let section = Animation.smooth(duration: 0.28)
    static let profile = Animation.spring(duration: 0.32, bounce: 0)
    static let symbol = Animation.easeOut(duration: 0.18)
}
```

Entering/exiting state uses ease-out and remains under 300ms. On-screen morphing uses a critically damped spring with zero bounce. Do not add arbitrary stagger or bounce.

## Repo conventions to follow

- Shared visual values already live under `ios/PersonalSite/Core/`, for example colors in `Core/Theme.swift`.
- The Xcode project uses synchronized folders; adding `Motion.swift` requires no `project.pbxproj` edit.
- Reduced-motion decisions remain at the owning view because each interaction needs a different fallback.

## Steps

1. Add `Core/Motion.swift` with the five tokens above.
2. Replace only equivalent handwritten animations when executing later plans; do not mechanically replace loader timing or native `NavigationStack` animations.
3. Add a short doc comment explaining that movement tokens must be replaced with opacity-only `stateChange` feedback when `accessibilityReduceMotion` is true.

## Boundaries

- Do not add dependencies or UIKit animation bridges.
- Do not change visual layout, navigation, or data loading in this plan.
- Do not centralize feature-specific narrative timing such as Bio character delays.

## Verification

- **Mechanical**: build and test the `PersonalSite` scheme; `git diff --check` must pass.
- **Feel check**: this plan must produce no visible behavior change by itself.
- **Done when**: the token file exists, compiles, and later plans can reference it without duplicating durations.
