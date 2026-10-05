---
id: TKT-164
title: Demo hosts apply views through the viewer package's camera adapter, and a test forbids a second copy
status: open
depends_on: []
owner:
fence: [deps/bim-open-viewer/packages/demos/src/**, deps/bim-open-viewer/packages/viewer/src/adapters/**, deps/bim-open-viewer/packages/viewer/src/index.ts, deps/bim-open-viewer/packages/viewer/test/**, deps/bim-open-viewer/packages/demos/test/**, deps/bim-open-viewer/eslint.config.*, deps.json]
related: [TKT-161]
created: 2026-10-05
kind: defect
---

## Acceptance criteria

- [ ] No file under deps/bim-open-viewer/packages/*/src other than packages/viewer/src/adapters/camera.ts assigns camera.near or camera.far, and a test enforces it
- [ ] The gallery, slice, feature-demo and ambient-occlusion pages show the whole model at every zoom level
- [ ] deps.json pins the viewer commit that carries the fix

Follow-up to TKT-161, which re-cut the near and far planes around the scene bounds on every frame in the viewer package (`packages/viewer/src/view.ts` calls `withDepthRange` from `packages/interact/src/projection.ts`). The gallery and demo hosts in `deps/bim-open-viewer/packages/demos` did not get the fix: each keeps its own hand-written `applyView` that copies `view.projection.near/far` straight onto a three.js `PerspectiveCamera`, so after a dolly they clip exactly as the studio did.

The four copies, 2026-10-05:

- `packages/demos/src/gallery/camera.ts` (used by `gallery/viewer.ts`)
- `packages/demos/src/slice/camera.ts` (used by `slice/mount.ts`)
- `packages/demos/src/feature-demos/_shared/camera.ts` (used by `_shared/host.ts`)
- `packages/demos/src/ambient-occlusion/stage.ts` (used by `ambient-occlusion/mount.ts`)

The viewer package already exports the one correct seam: `applyPerspective` and `applyOrthographic` in `packages/viewer/src/adapters/camera.ts`, re-exported from `@bim-open-viewer/viewer`, which the demos package already depends on.

Why they drifted: the same ten lines live in five files, so a fix to one leaves four behind (PRINCIPLES.md rule 4). The repair has two halves, the fix and the guard that keeps it fixed:

1. **Fix.** Delete the four `applyView` copies. Each host imports `applyPerspective` (and `applyOrthographic` where it has an orthographic camera) from `@bim-open-viewer/viewer` and passes the view through `withDepthRange(view, bounds)` with its scene's current bounds before applying, every frame, the way `packages/viewer/src/view.ts` does. If a host has no bounds at hand, give it the scene's bounds the way `create-viewer.ts` does. The ray and projection helpers next to the copies (`rayThroughClientPoint`, `projectToCanvas`, `matrix4From`, ...) may stay for now if moving them grows the change; note any that duplicate `rayThroughCamera` or `ndcOf` from the viewer package in the Result section as a follow-up.
2. **Guard.** A test that fails when a new copy appears: scan every `packages/*/src/**/*.ts` for assignments to `.near` or `.far` (and for `camera.fov =`, `camera.updateProjectionMatrix()`) and allow them only in `packages/viewer/src/adapters/camera.ts`. Put it where the repository's other repository-wide tests live, or in `packages/viewer/test/` if there are none. If the eslint config is simple to extend, add an equivalent `no-restricted-syntax` rule as well, so the editor flags it before the test does; one guard is required, the second is optional.

Verification: the viewer workspace tests pass; the pages smoke (`dist-pages`, see the viewer README) or a browser-pane check of the gallery and one demo page shows zooming in and out clips nothing; the guard test fails if one of the deleted copies is restored.

Commit in `deps/bim-open-viewer` by path, push, then update the pin in `deps.json` in the toolkit and push. Fix and guard are separate commits.
