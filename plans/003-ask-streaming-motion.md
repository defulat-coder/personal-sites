# 003 — Stabilize Ask streaming motion

- **Status**: DONE
- **Commit**: a7d4980
- **Severity**: HIGH
- **Category**: Purpose, frequency, and performance
- **Estimated scope**: 2 files, about 120 lines

## Problem

`ios/PersonalSite/Features/Ask/AskView.swift:145-156` animates every streamed text delta:

```swift
.onChange(of: model.messages.last?.text) {
    scrollToBottom(proxy)
}

private func scrollToBottom(_ proxy: ScrollViewProxy) {
    guard let lastID = model.messages.last?.id else { return }
    withAnimation { proxy.scrollTo(lastID, anchor: .bottom) }
}
```

An SSE response can update dozens or hundreds of times. Restarting an animated scroll on each delta makes the viewport chase a moving target, prevents comfortable reading, and creates unnecessary main-thread work.

## Target

- Animate once when a new message bubble is inserted with `PSMotion.stateChange`.
- Streamed token updates scroll without animation only while the user is already following the bottom.
- If the user scrolls upward, stop automatic following until they explicitly return to the bottom.
- Progress-to-answer, banner, failure label, and sources use opacity-only 200ms transitions. Do not animate every character.
- Reduced Motion behavior is identical except message insertion also becomes opacity-only.

## Repo conventions to follow

- Keep `AskChatModel` as the owner of network and message state.
- Keep `ScrollViewReader` and native `ProgressView`.
- Reuse `PSMotion.stateChange` from plan 001.

## Steps

1. Add view-owned `@State private var followsLatest = true` and a bottom sentinel with a stable ID.
2. Detect whether the bottom sentinel is visible using `onGeometryChange` or a minimal preference value. Set `followsLatest = false` when the user scrolls away; do not infer this from message length.
3. Replace the two current `onChange` handlers: message-count changes may call `withAnimation(PSMotion.stateChange)`; text changes call `proxy.scrollTo` without animation only when `followsLatest` is true.
4. Apply `.transition(.opacity.combined(with: .move(edge: .bottom)))` only to newly inserted message bubbles, with a maximum 12pt effective travel. Use `.opacity` alone under Reduce Motion.
5. Give the ProgressView/MarkdownText branch, banner, failure label, and sources `.transition(.opacity)` and scope `.animation(PSMotion.stateChange, value:)` to their exact booleans.
6. Add tests for follow-state logic if extracted; do not fake SSE timing in a view test.

## Boundaries

- Do not change the SSE protocol, API client, request throttling, Markdown renderer, or message copy.
- Do not add bounce, per-token animation, typewriter effects, or haptics.
- Do not force-scroll a user who has moved away from the bottom.

## Verification

- **Mechanical**: existing tests pass; add focused tests for any extracted follow-state reducer.
- **Feel check**: stream a long answer, then scroll upward mid-stream. The content must stop pulling the viewport. Return to the bottom and confirm token updates remain visually stable. Send two questions quickly after completion and confirm each new bubble enters once.
- **Done when**: streaming feels stationary and readable, with motion reserved for message-level state changes.
