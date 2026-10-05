---
id: TKT-164
title: Demo hosts apply views through the viewer package's camera adapter, and a test forbids a second copy
status: done
depends_on: []
owner: builder 9dd089ad background agent
session: 9dd089ad-69be-4ffa-97ac-df10dcfb1738
fence: [deps/bim-open-viewer/packages/demos/src/**, deps/bim-open-viewer/packages/viewer/src/adapters/**, deps/bim-open-viewer/packages/viewer/src/index.ts, deps/bim-open-viewer/packages/viewer/test/**, deps/bim-open-viewer/packages/demos/test/**, deps/bim-open-viewer/eslint.config.*, deps.json]
related: [TKT-161]
created: 2026-10-05
claimed: 2026-10-05
closed: 2026-10-05
kind: defect
---

## Acceptance criteria

- [x] No file under deps/bim-open-viewer/packages/*/src other than packages/viewer/src/adapters/camera.ts assigns camera.near or camera.far, and a test enforces it
- [x] The gallery, slice, feature-demo and ambient-occlusion pages show the whole model at every zoom level
- [x] deps.json pins the viewer commit that carries the fix

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

## Result

Done 2026-10-05 by builder 9dd089ad.

**What changed, in `deps/bim-open-viewer` (pushed to origin main):**

- `42804fc` Fix. The four `applyView` copies are deleted from `packages/demos/src/gallery/camera.ts`, `slice/camera.ts`, `feature-demos/_shared/camera.ts` and `ambient-occlusion/stage.ts`. Each host (`gallery/viewer.ts`, `slice/mount.ts`, `_shared/host.ts`, `ambient-occlusion/mount.ts`) now has one `writeCamera` that calls `applyPerspective(camera, withDepthRange(view, bounds), aspect())`, with the bounds from its `SceneBinding` (the gallery uses `binding.bounds()`, the union of everything drawn, as `create-viewer.ts` does). The ambient-occlusion stage no longer sets the camera aspect in `resize`; the page writes the view again after a resize. The two camera tests set their camera up through `applyPerspective`.
- `915404d` Guard. `packages/viewer/test/camera-adapter-only.test.ts` scans every `.ts`/`.tsx` under `packages/*/src` for `.near =`, `.far =`, `.fov =` and `updateProjectionMatrix()` and allows them only in `packages/viewer/src/adapters/camera.ts`; the retired alpha `packages/core/src/viewer.ts` keeps its one `updateProjectionMatrix()` on resize as a named allowance (it sets no plane). `eslint.config.js` adds a `no-restricted-syntax` block over the V2 files, ignoring the adapter, with the same two selectors.

**In the toolkit:** `e456220` pins bim-open-viewer `915404d` in `deps.json`.

**Verified:**

- `npm test` across the viewer workspace: every package green except the three pre-existing `ui-gratify` theme failures. `tsc --noEmit` and `eslint` over `packages/demos` and `packages/viewer` clean.
- Restoring the slice copy from `HEAD~1` makes the guard test fail naming `slice/camera.ts:27-31`, and eslint reports the same four lines; the copy was then deleted again.
- In the browser pane on the `gallery` dev server (port 5190): `gallery.html?demo=section&fixture=duplex`, `ambient-occlusion.html` and `slice.html` zoomed far in (camera inside the model, near walls drawn) and far out (whole model drawn) with no clipping and no console errors.

**Left open (follow-ups, not filed as tickets):**

- The ray and projection helpers beside the deleted copies still duplicate the viewer package's: `matrixOf` in `slice/camera.ts` and `_shared/camera.ts` and `matrix4From` in `gallery/camera.ts` are `matrixOf` from `adapters/camera.ts`; `rayThroughPoint` (slice), `rayThroughClientPoint` (gallery) and `rayThroughCanvasPoint` (feature demos) are `ndcOf` plus `rayThroughCamera`. Moving them is a second small job over the same four files.
- The feature-demos page (`vite.feature-demos.config.mjs`) was not opened in the browser; its host shares the code path and its unit tests pass.
- The hosts compute the aspect themselves and pass it to `applyPerspective`; the alpha `Viewer.resize` also sets it. Harmless, but one more place than needed.
