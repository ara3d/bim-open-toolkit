---
id: TKT-161
title: Widen the 3D viewer's near and far planes so zooming in or out never clips the model
status: open
depends_on: []
owner:
fence: [deps/bim-open-viewer/packages/interact/src/projection.ts, deps/bim-open-viewer/packages/interact/src/camera.ts, deps/bim-open-viewer/packages/interact/test/**, deps/bim-open-viewer/packages/core/src/viewer.ts, deps.json]
created: 2026-10-04
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
