# 005 — Make Bio animation lifecycle-safe

- **Status**: DONE
- **Commit**: a7d4980
- **Severity**: MEDIUM
- **Category**: Interruptibility and accessibility
- **Estimated scope**: 2 files, about 140 lines

## Problem

`ios/PersonalSite/Features/Home/BioView.swift:148-156` starts an untracked task:

```swift
private func startIfNeeded() {
    guard !hasStarted, startSignal else { return }
    hasStarted = true
    ...
    Task { await playSequence() }
}
```

The task is not attached to SwiftUI’s `.task` lifecycle and the caret Timer in lines 77-81 remains separately scheduled. Leaving Home can allow the sequence to keep mutating state and calling completion offscreen. The full English body is typed, erased, and replaced before the final Chinese body becomes stable.

## Target

- Drive the sequence from `.task(id:)` so SwiftUI cancels it when the view disappears or the start signal changes.
- Cancellation immediately restores a valid readable end state; returning Home never shows an empty or half-erased body.
- Keep the rare greeting/title delight, but render body paragraphs immediately after the first title phase instead of typing and erasing every paragraph.
- Use no positional motion. Reduced Motion shows final Chinese copy immediately and never starts the loop.

## Repo conventions to follow

- Keep `BioView.profileCopy` and `profileCopyEnglish` as the copy source.
- Keep all UI mutation on `@MainActor`.
- Preserve the app-level `bioPlayed` session rule.

## Steps

1. Replace `.onAppear`/`.onChange` task launching with `.task(id: startSignal)` and call one async driver from that structured task.
2. Wrap the driver in cancellation handling. On cancellation, call a synchronous final-state function that sets Chinese body counts, clears active typing state, and hides the caret.
3. Remove the perpetual Combine Timer. Use a `TimelineView(.periodic)` scoped only to an active caret, or make caret visibility a small phase animation that stops when typing stops.
4. Shorten the narrative: type the greeting/title, reveal each paragraph as a complete block with 30–80ms non-blocking stagger, then enter the greeting loop. Do not animate each body character.
5. Keep `reduceMotion || !shouldPlaySequence` as an immediate final-state path.
6. Add unit tests for cancellation/final-state logic by extracting the phase reducer or timeline state from the view.

## Boundaries

- Do not change biography wording or typography.
- Do not add sound, haptics, bounce, or third-party typing libraries.
- Do not let animation delay access to navigation controls.

## Verification

- **Mechanical**: focused Bio tests and the full iOS test suite pass.
- **Feel check**: launch Home, switch sections during English typing, then return. Copy must be readable and stable with no resumed erase from an old task. Repeat with Reduce Motion enabled.
- **Done when**: no Bio task survives view disappearance and every interruption lands on a complete readable state.
