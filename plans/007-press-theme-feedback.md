# 007 — Add immediate press and theme feedback

- **Status**: DONE
- **Commit**: a7d4980
- **Severity**: MEDIUM
- **Category**: Response and physicality
- **Estimated scope**: 3 files, about 100 lines

## Problem

The high-frequency section buttons in `ios/PersonalSite/Features/Support/SiteHeaderView.swift:89-112` use `.buttonStyle(.plain)` and provide no explicit touch-down response. `ThemeToggleButton` changes the theme and symbol immediately in lines 35-38, producing an abrupt brightness and icon jump.

## Target

- Section buttons respond on touch-down with scale `0.97` and opacity `0.78`; restoration uses `PSMotion.press` at exactly 160ms ease-out.
- Press feedback never delays the action and remains available under Reduce Motion because it is small, local feedback; if accessibility testing shows scale is undesirable, keep opacity only.
- Theme symbol uses an iOS 17 symbol replacement transition and `PSMotion.symbol` at 180ms.
- Theme color change uses a short 200ms opacity/color transition, never a full-screen slide or flash.

## Repo conventions to follow

- Implement reusable feedback as a private or Core `ButtonStyle`, not repeated modifiers.
- Keep controls as `Button`/`Link` for accessibility.
- Keep existing labels and 44pt-equivalent hit areas.

## Steps

1. Add `PSPressButtonStyle` using `configuration.isPressed`, `scaleEffect(0.97)`, opacity `0.78`, and `.animation(PSMotion.press, value: configuration.isPressed)`.
2. Apply it to section navigation buttons and any icon-only custom button that currently has no native pressed appearance. Do not override native List/NavigationLink feedback.
3. Give the sun/moon image stable identity and use `contentTransition(.symbolEffect(.replace))` or the iOS 17 equivalent supported by the installed SDK.
4. Wrap the theme state change in a narrowly scoped `PSMotion.symbol`/`stateChange` transaction. Confirm dynamic colors interpolate; if `preferredColorScheme` cannot interpolate reliably, use a 200ms surface overlay fade instead of animating every descendant.
5. Add `.sensoryFeedback(.selection, trigger:)` only for the theme toggle if product testing confirms it adds utility; do not add haptics to every section tap.

## Boundaries

- Do not change labels, colors, typography, or navigation behavior.
- Do not apply press scaling to full list rows, text fields, or external links that already use native feedback.
- Do not use bounce or scale below 0.95.

## Verification

- **Mechanical**: build and test on iOS 17+ destination.
- **Feel check**: touch and hold a section label; feedback must appear before release and cancel cleanly when dragging away. Toggle theme repeatedly and confirm the icon replacement remains legible with no brightness flash. Test Reduce Motion and VoiceOver.
- **Done when**: every custom high-frequency control responds immediately without adding decorative delay.
