# iOS Motion Plans

The plans in this directory were produced from the current working tree on top of commit `a7d4980`.
The working tree already contains uncommitted iOS edits in:

- `ios/PersonalSite/App/PersonalSiteApp.swift`
- `ios/PersonalSite/Features/Home/HomeView.swift`
- `ios/PersonalSite/Features/Support/SiteHeaderView.swift`

Executors must preserve those edits and all unrelated dirty files. If those three files no longer match the excerpts in the plans, stop and report drift.

| Plan | Title | Severity | Status | Depends on |
| --- | --- | --- | --- | --- |
| 001 | Establish native motion tokens | MEDIUM | DONE | — |
| 002 | Rebuild the profile and section transition | HIGH | DONE | 001 |
| 003 | Stabilize Ask streaming motion | HIGH | DONE | 001 |
| 004 | Replace the blocking launch animation | HIGH | DONE | 001 |
| 005 | Make Bio animation lifecycle-safe | MEDIUM | DONE | 001 |
| 006 | Smooth loading and media state changes | MEDIUM | DONE | 001 |
| 007 | Add immediate press and theme feedback | MEDIUM | DONE | 001 |
| 008 | Make the signal field display-aware | LOW | DONE | 001 |

## Recommended execution order

1. `001-native-motion-tokens.md`
2. `002-profile-section-transition.md`
3. `003-ask-streaming-motion.md`
4. `004-launch-experience.md`
5. `005-bio-animation-lifecycle.md`
6. `006-loading-state-transitions.md`
7. `007-press-theme-feedback.md`
8. `008-signal-field-cadence.md`

After each plan, run the plan-specific checks plus:

```bash
cd ios
xcodebuild -scheme PersonalSite -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
git diff --check
git status --short
```

Do not add a third-party animation library. The app targets iOS 17+, so use native SwiftUI `Animation`, transitions, `contentTransition`, `symbolEffect`, `TimelineView`, and structured concurrency.
