# 006 — Smooth loading and media state changes

- **Status**: DONE
- **Commit**: a7d4980
- **Severity**: MEDIUM
- **Category**: Missed opportunity and cohesion
- **Estimated scope**: 7 files, about 150 lines

## Problem

`ios/PersonalSite/Features/Support/LoadStateView.swift:29-47` conditionally replaces loading, error, empty, and content views without a transition. The same teleport occurs in detail screens and `AsyncImage` branches, for example `CurationDetailView.swift:11-25` and `:120-130`.

## Target

- Keep a stable full-size state container.
- Loading/error/empty/content changes use opacity only, 200ms ease-out through `PSMotion.stateChange`.
- Images reserve their final aspect-ratio frame before loading; placeholder-to-image uses 200ms opacity so layout does not jump.
- Do not animate list pagination, refresh-driven row reordering, or every row.
- Reduced Motion uses the same opacity-only transition.

## Repo conventions to follow

- Centralize generic phase behavior in `LoadStateView`.
- Keep native `ProgressView`, `ContentUnavailableView`, `AsyncImage`, and `List`.
- Preserve existing error and empty-state copy.

## Steps

1. Add a stable state identity enum inside `LoadStateView` and wrap the branch in a `ZStack` with `.transition(.opacity)` and `.animation(PSMotion.stateChange, value: stateIdentity)`.
2. Apply the same state identity pattern to `AiNewsDetailView`, `CurationDetailView`, `OpenSourceDetailView`, and `RepositoryFileView`; do not animate the outer `NavigationStack`.
3. For Curation media and Work screenshots, reserve a frame using the known aspect ratio or a fixed neutral placeholder before `AsyncImage` resolves.
4. Transition only the placeholder/image/failure child with `.opacity`; retain clipping and final aspect ratio.
5. Verify refresh keeps existing content visible while loading when data is already present.

## Boundaries

- Do not add skeleton shimmer, row stagger, blur over 2px, or new image dependencies.
- Do not change pagination, caching, API calls, or list identity.
- Do not animate `List` row height changes caused by remote data.

## Verification

- **Mechanical**: build and all model/view tests pass.
- **Feel check**: test fast and throttled network. Loading-to-content must fade without a white flash or vertical jump. Pull-to-refresh must retain native behavior. Inspect images at 10% playback speed and confirm only opacity changes.
- **Done when**: every remote-data phase has a stable frame and no content teleports into place.
