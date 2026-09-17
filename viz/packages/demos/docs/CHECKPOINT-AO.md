# Track AO checkpoint: ambient occlusion pass, test and demo

Track AO (invented; not in `.claude/wave.json`). Fence: `viewer/packages/render/src/ambient-occlusion.ts`, `viewer/packages/render/test/ambient-occlusion.test.ts`, `viewer/packages/demos/ambient-occlusion.html`, `viewer/packages/demos/vite.ao.config.mjs`, `viewer/packages/demos/src/ambient-occlusion/**`, `viewer/packages/demos/test/ambient-occlusion/**`, `viewer/packages/demos/docs/ambient-occlusion.md`, this file. Plus one additive export block in the supervisor-owned `viewer/packages/render/src/index.ts`, called out below.

State: **verified** against the gates below. Contract revision: M1 with M1.1 and M1.2, unchanged. Delegates spawned: 0.

## Delivered

- `render/src/ambient-occlusion.ts`: `AmbientOcclusionSettings` (enabled, radius, intensity, samples, resolution scale, shaded or occlusion-only output), `checkAmbientOcclusion`, `occlusionRadiusFor` (a twentieth of the widest extent, `occlusionRadiusShare`), `occlusionBufferSize`, `ambientOcclusionPass` (resolved, or undefined when off), the one-method seam `AmbientOcclusionTarget`, `applyAmbientOcclusion` returning a `Disposable`, and `heightFieldVisibility`, a pure horizon-based estimator over a height field that states what the GPU pass approximates. No `three` import; 22 tests including a closed-form case.
- `demos/ambient-occlusion.html` on port 5177: three's GTAO pass behind the seam, over viewer-core's `SceneObject` with a page-owned `WebGLRenderer` and composer; three synthetic fixtures (building, city, stress at 2,000 instances); panel built from control descriptions and parsed through the render package's check; compare-while-held; status line with counts, pass, frame interval and renderer string. `docs/ambient-occlusion.md` says what it shows and what it does not.
- Tests: 15 in Node (fixtures bind, building counts match the slice's, panel round-trips the default and refuses what render refuses, luminance statistics, readout) and one browser smoke with software WebGL that measures the drawing buffer: shaded-with-pass is darker than plain, the occlusion term has open and enclosed pixels, a second fixture opens. Skips with a reason when no browser launches.

## Commands and actual results (from `viewer/`, other tracks compiling)

| Command | Result | Wall |
|---|---|---|
| `npx tsc --noEmit -p packages/render/tsconfig.json` | exit 0 | 8 s |
| `npx eslint packages/render` | exit 0 | 37 s |
| `npm test -w @bim-open-toolkit/render` | 12 files, 243 passed | 2 s |
| `npx tsc --noEmit -p packages/demos/tsconfig.json` | exit 0 | 46 s |
| `npx eslint packages/demos/src/ambient-occlusion packages/demos/test/ambient-occlusion` | exit 0 | 13 s |
| `npx vitest run test/ambient-occlusion/steps.test.ts` (in `packages/demos`) | 15 passed | 7 s |
| `npx vitest run test/ambient-occlusion/page.test.ts` | 1 passed, Edge headless, SwiftShader | 65 s |

Browser smoke numbers (software WebGL, 1280 by 800, building, automatic radius 0.82 m): occlusion term min 0.620, max 1.000; whole-frame luminance mean 0.174 plain against 0.173 with the pass, a small move because most of the frame is background and unlit wall. The shaded-darker assertion held on four runs; the occlusion-term assertion is the strong one. Screenshots under `viewer/artifacts/ambient-occlusion/`. Hardware check in the desktop app's browser: frame interval 3.8 ms with the pass on the building; the pane throttles animation frames to one a second while hidden, which is the pane, not the page.

## Chunk commits

| Commit | Chunk |
|---|---|
| `5c2cf06` | Render module, tests, index export |
| `0de20b9` | Drop `denoise` (GTAO always filters before blending); buffer size takes settings or pass |
| `1d73bd6` | Automatic radius a twentieth of the model, exported share |
| `9c66f83` | Demo page, adapter, Node and browser tests, README, this checkpoint |
| follow-up | This file: commit hash and the smoke run's measured numbers |

Staged by explicit pathspec, message from a file, no amend, nothing pushed. Untracked slice files and other tracks' modified files were never staged.

## Findings

1. **viewer-core's `Viewer` cannot host a post-processing pass.** Its `WebGLRenderer` is private and `renderFrame` calls `renderer.render` directly. The page drives `SceneObject.sync` and its own renderer instead, re-implementing about twenty lines of `Viewer`. Request to the alpha core: a render hook (`render(scene, camera)` replaceable) or a public renderer.
2. **GTAO's `thickness` must scale with the radius.** It discards samples whose depth differs by more than `thickness` world units (default 1). At a 2.5 m radius on a building that dropped most of every wall and the effect read as a line at the foot. The adapter sets thickness to four times the radius, three's own example ratio. Found only on a real GPU, which is why the demo exists.
3. **A fiftieth of the model is too small a radius; a twentieth reads.** Changed in `1d73bd6`; the demo's test reads the exported share rather than a literal.
4. **Hidden and transparent instances occlude.** GTAO's normal and depth pre-pass uses an override material without viewer-core's instance-alpha discard. Documented as a limitation; a feature over a model with hidden rows needs the discard in the override.
5. **A zero-size canvas at mount makes every draw a GL error until the next resize.** The stage clamps buffers to one pixel. The desktop app's pane lays the canvas out after the script runs; playwright does not.
6. `applyView` (interact view onto a three camera) is duplicated from the E2E slice's uncommitted `camera.ts`. Both belong in Track V's `createViewer`.

## Requests

- Supervisor: add Track AO to `.claude/wave.json` and the status table; review the `render/src/index.ts` export block (additive, one `//` line).
- Gallery wave: register this page as a demo (`environment` chapter, F10) once G1 lands; the panel descriptions in `controls.ts` are what a Gratify panel reads.
- Alpha core: finding 1.

## Tooling

| Check | Runs | Wall | Caught | Friction | Verdict |
|---|---:|---:|---|---|---|
| tsc | 6 | 8 to 46 s | 0 | 46 s for demos under load | neutral this track |
| eslint | 4 | 13 to 37 s | 0 | none | neutral |
| vitest Node | 8 | 1 to 7 s | 2: a `Math.round` tie made the two sides of a wall differ in the estimator; a wrong city object count in a test | fast enough to run on every edit | helpful |
| browser smoke | 4 | 55 to 100 s | 1: the window report was stale after a fixture switch | a vite re-optimisation on first run | helpful; the measurements are the only check on the pass itself |
| hardware look (app browser pane) | 5 | seconds | 2: findings 2 and 5, invisible in software WebGL | the pane throttles frames when hidden | helpful; not a gate |
