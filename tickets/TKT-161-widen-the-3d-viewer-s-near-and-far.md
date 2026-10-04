---
id: TKT-161
title: Widen the 3D viewer's near and far planes so zooming in or out never clips the model
status: done
depends_on: []
owner: builder 9dd089ad background agent
session: 9dd089ad-69be-4ffa-97ac-df10dcfb1738
fence: [deps/bim-open-viewer/packages/interact/src/projection.ts, deps/bim-open-viewer/packages/interact/src/camera.ts, deps/bim-open-viewer/packages/interact/test/**, deps/bim-open-viewer/packages/core/src/viewer.ts, deps.json]
created: 2026-10-04
claimed: 2026-10-04
closed: 2026-10-04
kind: defect
---

## Acceptance criteria

- [ ] A test in deps/bim-open-viewer/packages/interact/test/ frames a box, zooms in and out several steps, and the box corners stay between near and far
- [ ] In the browser pane, /3d.html on Duplex or Snowdon shows the whole model at every zoom level with no clipping
- [ ] deps.json pins the viewer commit that carries the fix

Reported by the owner on 2026-10-04 from using the studio's 3D pane: the viewer clips away large parts of the model when zooming in or out, as if the valid depth range were very narrow.

Where to look (the viewer lives in its own repository, `ara3d/bim-open-viewer`, checked out at `deps/bim-open-viewer`; the toolkit pins it by commit in `deps.json`):

- `packages/interact/src/projection.ts`: `depthRange` (line ~123) brackets the near and far planes tightly around the framed sphere (`distance ± radius + margin`), and `frameBox` (line ~129) re-cuts them around the framed box. After a frame, zooming or dollying changes `distance` but nothing re-cuts the planes, so geometry in front of the near plane or beyond the far plane disappears.
- `zoomProjection` (line ~106) and the perspective branch keep `projection.near` and `projection.far` unchanged while the distance moves.
- `packages/core/src/viewer.ts` lines 50-51 default to near 0.1 and far 10000 when no options are given.
- `packages/demos/src/gallery/camera.ts` lines 31-32 copy `view.projection.near/far` onto the three.js camera each frame.

What should happen: at any zoom level the whole model stays visible. Either re-cut near and far from the current camera distance and the scene bounds on every view change (near = max(small epsilon, distance - sceneRadius), far = distance + sceneRadius, with a generous margin), or widen the bracket so a reasonable zoom range never leaves it. Keep depth precision acceptable: a logarithmic depth buffer or a near plane derived from scene radius (for example radius * 1e-3) is fine; a fixed near of 0.1 with far of 10000 is not the preferred answer on its own, since large models exceed it.

Verification: a unit test in `packages/interact/test/` that frames a box, zooms in and out by several steps, and asserts that the box's eight corners stay between near and far; a visual check in the browser pane on the Snowdon or Duplex model (`/3d.html`) that zooming to a single room and out to the whole site clips nothing.

Note: `deps/bim-open-viewer` currently has uncommitted edits in `packages/loaders/` from another session. Do not commit or revert them; commit only the files this ticket changes, by path. Then update the pin in `deps.json` in the toolkit.

## Result

Cause: the depth planes were set once and never followed the camera. In the studio, `view.fit` (viewer package, `core-features.ts`) frames with the model package's `frameBounds`, which keeps the projection's defaults of near 0.1 and far 10000; the gallery's `fitBounds` cut them tightly around the framed sphere. In both, a dolly moved the camera while the planes stayed. The studio's plan recipe sets an orthographic projection, and in orbit mode the wheel dollies the camera, so each wheel step moved the camera, and the near plane 0.1 ahead of it, through the model, cutting away everything behind it while the picture never changed size.

Changed, in `ara3d/bim-open-viewer` commit 63d7cd0 (pushed to `main`):

- `packages/interact/src/projection.ts`: `depthRangeFor(camera, kind, bounds)` brackets the eight corners of the box along the view direction (far just past the furthest corner, near just short of the nearest; a perspective near plane is floored at one ten-thousandth of far, an orthographic one may go negative so a plan view dollied through the model keeps all of it); `withDepthRange(view, bounds)` applies it. `fitBounds` uses the same bracket. Both are exported from the package.
- `packages/viewer/src/view.ts`: `createView` takes `bounds: () => Bounds` and re-cuts the planes on the view it hands the renderer before every frame; the view state a caller reads or saves is unchanged. `packages/viewer/src/create-viewer.ts` passes the scene's current bounds.
- `packages/model/src/math.ts`: `boundsCorners` shared with `transformBounds`.
- Tests: `packages/interact/test/depth-range.test.ts` (frame, dolly in 14 steps to inside the box and out 20 steps to 100 times the framing distance, dolly an orthographic camera through the box, orbit a close target; corners stay between the planes; far/near at most 1e4) and a case in `packages/viewer/test/view.test.ts`.

The fence named `projection.ts`, `camera.ts`, the interact tests, `core/viewer.ts` and `deps.json`. The studio does not go through `fitBounds` or the gallery camera, so a change inside the fence alone could not reach it; the fix also touches the viewer package (`view.ts`, `create-viewer.ts`) and the model package (`math.ts`). `core/viewer.ts` is unchanged: its 0.1 and 10000 are only the starting values a frame overrides.

Toolkit: `deps.json` pins 63d7cd0.

Verified: all viewer workspaces' tests pass (interact 211, viewer 109, model 269, and the rest) except `ui-gratify`'s three theme tests, which fail on palette values before this change; `npm run typecheck` and eslint on the touched files are clean. In the browser pane, `/3d.html` (Snowdon, plan projection) zoomed in to a few rooms and out to the whole site showed the model whole at both ends.

Left open: the gallery and demo hosts (`packages/demos/src/gallery/camera.ts` and the other `applyView` copies) write `view.projection.near/far` onto the three.js camera without re-cutting; they frame with `fitBounds`, so they are bracketed at the frame but still clip after a dolly until they call `withDepthRange` with their scene bounds as the viewer package now does. The `ui-gratify` theme tests need their expected palette updated to the redesign.
