# 004 — Replace the blocking launch animation

- **Status**: DONE
- **Commit**: a7d4980
- **Severity**: HIGH
- **Category**: Purpose and responsiveness
- **Estimated scope**: 4 files, about 180 lines plus project launch-screen configuration

## Problem

`ios/PersonalSite/Features/Support/OpeningLoaderView.swift:18-23` defines a 5.8-second sequence on every normal process launch:

```swift
private static let revealAt = 5.0
private static let revealDuration = 0.8
```

The view runs a 30fps `TimelineView`, a WKWebView-hosted animated SVG, and a full-screen vertical exit. `PersonalSiteApp.swift` shows it on every launch unless a debug default skips it. This blocks interaction long after the first screen is ready.

## Target

- Configure a static native launch screen that visually matches the home surface and is replaced immediately by the first screen.
- Move the existing branded sequence to an optional first-run welcome experience, persisted with `@AppStorage` and never shown on ordinary return launches.
- The welcome is dismissible as soon as it appears; no animation may block navigation.
- If retained, its exit is a 200ms opacity transition. No full-screen positional movement.
- Reduce Motion shows the final static welcome frame and the same 200ms fade.

## Repo conventions to follow

- Preserve the SVG asset and battery artwork unless product explicitly removes the welcome.
- Keep secrets and network work out of launch configuration.
- Use native SwiftUI and the project’s synchronized-folder setup.

## Steps

1. Add or configure `UILaunchScreen`/launch-screen assets so the launch screen uses `Color.psSurface`-equivalent light/dark backgrounds and no animated content.
2. Replace `showLoader` with an `@AppStorage` first-run flag such as `hasSeenWelcome`. The first app screen must render immediately underneath.
3. Rename the experience to `WelcomeAnimationView` and present it as an overlay/onboarding surface only when the flag is false.
4. Add an accessible Skip button immediately; completing or skipping sets the flag once.
5. Replace the 0.8-second vertical reveal with `PSMotion.stateChange` opacity. Remove the custom full-screen offset calculation while preserving the internal battery/character sequence if it remains.
6. Preserve `-skipLoader YES` only if tests/screenshots still need it; document the new first-run reset argument if added.

## Boundaries

- Do not run migrations or touch Supabase configuration.
- Do not use the launch screen for networking or custom code.
- Do not delete branded assets without separate product approval.
- Do not show the welcome on every launch.

## Verification

- **Mechanical**: delete the app from Simulator, install, and launch. Then terminate and relaunch without deleting. Build and tests pass.
- **Feel check**: first install reaches an interactive first screen immediately and may show the optional welcome; second launch contains no branded delay. Toggle Reduce Motion and confirm there is no viewport-sized slide.
- **Done when**: ordinary launches are immediately usable and the branded sequence is optional, first-run-only, and skippable.
