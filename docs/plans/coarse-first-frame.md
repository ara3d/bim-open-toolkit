# Coarse first frame for Snowdon

Status: building
Request: TKT-15. `/3d.html?analysis=snowdon-toolkit` should show a coarse rendering in under 2 s warm, as `scripts/profile-bim-flow-startup.mjs` measures it. The coarse rendering is either bounding boxes or a decimated subset of instances. The page then refines to all 456,598 instances without a reload. The pane's status line tells coarse readiness apart from full readiness. First-frame and full-load times are logged against the 2 s target in `docs/bim-flow-startup.md`. Today the warm first frame takes 5.2 to 5.8 s, and there is no level of detail. The 43-second converter start is out of scope.

Open questions:

1. **Pane wiring.** `bimopenflow/web/packages/panes/**` belongs to TKT-16's plan, so this plan has no chunk there. The pane change needed is exactly this:
   - `viewerDeps.ts`: `ViewerRig.load(url, format, onPreview?: () => void)`. `defaultView3DDeps.load` calls `loadWithPreview(viewer, url, { ...the options it passes to loadModel today, onPreview: () => { if (trace.enabled) performance.mark("bimflow:coarse-frame-submitted"); onPreview?.(); } })` in place of `loadModel`. When a preview was drawn, it skips its `initial-fit` span, because the preview already framed the same bounds in the same up-axis convention and skipping keeps any camera move the user made.
   - `viewPane3D.ts`: passes `() => { if (!disposed && token === loadToken) status.textContent = "Coarse preview · loading full detail…"; }` as the third argument of `rig.load`. The full-readiness text (`"456,598 instances · orbit / pan / zoom"`) stays as it is. One test goes in `viewPane3D.test.ts`: a fake rig calls `onPreview` and then resolves, and the status shows the coarse text and then the full text.

   **Default:** TKT-16's plan leaves `ViewerRig.load`, the load path in `defaultView3DDeps`, and the status assignments in `load()` untouched. After TKT-16's pane chunks are committed, the supervisor gives TKT-15 a fence of exactly `viewerDeps.ts`, `viewPane3D.ts` and `test/viewPane3D.test.ts` for one chunk, P1. P1 depends on C5.
2. **Bounding boxes or a decimated subset?** **Default: boxes.** Every prepared BFAST already stores a world-space box per instance (`InstanceBoundsData`), so the preview is one pass over two tables and reads no geometry. A decimated subset of real meshes would still need the vertex and index validation (112 ms of parse), normals, and per-mesh groups. That is where the 1,966 ms first-render cost comes from. Boxes whose volume exceeds 0.1% of the model's volume are left out: 20 of Snowdon's 451,410. The largest is 46 × 112 × 64 m and would hide a whole tower.
3. **Precomputed artefact or derived at load?** **Default: derived at load**, from the bytes the pane already fetches. A precomputed artefact would need a change to the prepare step, the dev middleware in `bimopenflow/web/packages/app` (work in flight), and a new verified hash pair for the prepared file. The kill criteria below say when to reverse this.
4. **How does refinement swap in without a flash?** **Default:** `viewer.show` removes the preview in the same synchronous call that adds the full groups. On the pane side, `show`, colours, recipe mount and `applyRecipe` run without yielding, so the next frame drawn is the full model with its recipe. Until that frame, the canvas keeps showing the preview. There is never a blank frame and never a full frame without the recipe. The camera is kept (see question 1).
5. **How does the profile script report both frames?** Decision (supervisor, 2026-09-26): the fence is widened to `scripts/profile-bim-flow-startup.mjs` for chunk C7. The script navigates to `/3d.html?analysis=snowdon-toolkit&profileStartup=1`, waits for the full mark as it does today, and prints `coarseFrameSubmittedMs` (null when the mark is absent), `fullFrameSubmittedMs` (the mark previously reported as `firstFrameSubmittedMs`), `targetMs: 2000`, `coarseUnderTarget`, `navigations` (must be 1, meaning no reload), and the final status text.

## Brainstorm
skipped

## Acceptance criteria
- A warm run of `scripts/profile-bim-flow-startup.mjs` against `/3d.html?analysis=snowdon-toolkit` records `bimflow:coarse-frame-submitted` under 2,000 ms after navigation. The same page then records `bimflow:first-model-frame-submitted` (the full frame, with the recipe applied), with one navigation entry and no page errors.
- The coarse frame draws one box per drawn placement in its source colour. It leaves out hidden placements, placements with alpha 0, and placements whose box exceeds 0.1% of the model's volume. Translucent placements draw translucent.
- The camera the preview frames is the camera the full model would frame: same bounds, same up axis. Refinement does not move the camera.
- No frame is drawn with neither the preview nor the full model, and none with the full model before its recipe is applied.
- The status line reads "Coarse preview · loading full detail…" between the coarse frame and full load, then the existing "N instances · orbit / pan / zoom". This depends on P1 (question 1).
- A failed, cancelled or superseded load removes its preview. A source with no preview (BOS bytes, GLB, OBJ, STL) loads exactly as today.
- Picking hits nothing while only the preview is shown. The preview has no object identity.
- `docs/bim-flow-startup.md` logs coarse-frame and full-frame times from three warm runs against the 2 s target. `docs/bim-flow-3d.md` "Limits" describes what the preview is and is not.
- Excluded: the 43 s converter start; colouring the preview by recipe or category; worker-based parsing; reducing the full-frame time; a new graph node, wire type or pane input. Principle 5 holds because the preview lives inside the existing `model` input.

Evidence: JSON from `node scripts/profile-bim-flow-startup.mjs` with `coarseFrameSubmittedMs < 2000`, `navigations: 1` and the final status `"456,598 instances · orbit / pan / zoom"`, from three warm runs recorded in `docs/bim-flow-startup.md`. Also the report from C6 (`npm run perf -w @bim-open-toolkit/viewer`), giving milliseconds from bytes in hand to the preview frame and to the full frame, plus PNG captures of both frames under the ignored `artifacts/` folder.

Kill criteria: stop before C8 and re-plan with a precomputed preview served by the app (outside this fence) if either of these holds:
- C6 measures more than 700 ms on Snowdon from bytes in hand to the submitted preview frame.
- After P1, the warm profile shows the model bytes in hand later than 1,500 ms after navigation.

Either result means deriving the preview at load cannot reach 2 s. Today the bytes arrive at about 1,253 ms (725 ms page and graph plus 528 ms fetch), which leaves about 750 ms. The viz chunks C1 to C5 are still useful on that route, because `readBoxPreview` can read a sidecar file.

## Design

The system that makes this easy: the formats package can hand out a cheap box preview of a file before it parses the file, the viewer can draw a preview that the next `show` replaces atomically, and one helper sequences the two with a frame yield in between. Every host then gets coarse-then-full by swapping one call.

Snowdon facts, measured by the planner with a read-only pass over `viz/packages/visualization/artifacts/bfast/snowdon-bim.bfast` (111,630,208 bytes, the same size as the served prepared fixture):
- 471,462 instance records.
- 451,410 are drawn with alpha > 0. Another 5,188 have alpha 0 but are still bound, which gives 456,598.
- 7,784 are translucent.
- 20 boxes exceed 0.1% of the model's volume, and 158 exceed 0.01%.
- The instance tables sit at bytes 56.0 to 101.6 MB, after the vertex and index data.
- The full model has 6.16 M triangles; the box preview has 5.42 M.

The preview is cheap on the CPU, not on the GPU. It is one instanced group with a 36-index cube. The full model is thousands of batched groups with normals.

Modules:

- **`@bim-open-toolkit/formats`, new `src/preview.ts`**: `readBoxPreview(bytes)` reads the BFAST header and render tables through `@ara3d/viewer-loaders` (`readBFast` and `readRenderModelTables`, newly exported). It then makes one pass over the instance records:
  - It includes a record when the mesh is 0 or above, the mesh vertex count is above 0, the record is not hidden, and the transform is finite.
  - `bounds` is the union over all included records, alpha-0 ones as well, because the binding includes them. This makes `bounds` equal the bounds of the full binding.
  - `boxes` keeps the records with alpha > 0 whose volume is within the cap.
  - No geometry validation runs; the full parse still does that afterwards.
  - Worked example (the C2 fixture): meshes are a triangle (0..1 in x and y) and a square (0..2). The placements are:
    - A: triangle at the origin, white.
    - B: square moved to (5,0,0), colour [255,0,0,128].
    - C: no mesh.
    - D: triangle at (100,0,0), hidden.
    - E: triangle at (-3,0,0), alpha 0.

    The result is `count 2`, `boxes [0,0,0,1,1,0, 5,0,0,7,2,0]`, `colors [1,1,1,1, 1,0,0,128/255]`, `bounds {min [-3,0,0], max [7,2,0]}` and `oversized 0`. The volume cap is skipped because the bounds have zero volume.
- **formats `loadModel`**: a new optional `onPreview` runs once, after the bytes are resolved and detected as BFAST and before `readModel`. The load awaits it, then checks for cancellation. A preview that raises becomes a `formats/no-preview` warning, and the load continues. Worked example: `loadModel(sampleBfast(), { onPreview })` calls `onPreview` once with `count 2` before any `parse` progress event. OBJ bytes never call it.
- **`@bim-open-toolkit/viewer`, new `src/preview.ts` plus `Viewer.preview`**:
  - `previewGroups` builds instanced unit cubes: one opaque group and one translucent group, each omitted when empty. Each box axis is at least 0.001 of the bounds' diagonal, so flat boxes get thickness and a valid normal matrix.
  - `viewer.preview(boxes, { fit })` replaces any earlier preview, adds the groups to every view (including views added later), and draws every view now so the frame is submitted before it returns.
  - While no model is bound, `bounds()`, `view.fit` and the environment grid use `boxes.bounds`.
  - With `fit`, it applies the preview's coordinate convention (`applyCoordinateConvention`) and dispatches `view.fit`.
  - `show()` removes the preview in the same call that adds the model's groups. `dispose()` removes it too.
  - Worked example: over the fake renderer, previewing the C2 fixture adds 2 groups (A opaque; B translucent, scale (2,2,0.0102), translation (6,1,0)), adds one frame, and sets `viewer.bounds()` to `{[-3,0,0],[7,2,0]}` and the camera's up vector to `[0,0,1]`. After `show(model)`, the scene holds only the model's groups.
- **viewer, new `src/load-with-preview.ts`**: `loadWithPreview(viewer, source, options)` wraps `loadModel`, and its `onPreview` does three things in order:
  1. calls `viewer.preview(boxes, { fit })`
  2. calls the host's `onPreview`
  3. awaits `nextFrame()`, which by default is one animation frame and then one task, so the browser presents the preview before the parse holds the thread.

  On failure or cancellation it disposes the preview. On success it leaves the preview for `show` to replace. Worked example: the C2 fixture bytes call `onPreview` once, await the injected `nextFrame` once, and resolve `ok` with 3 objects. The preview groups stay in the scene until `show`.

What is reused: the loaders' BFAST reader, the stored instance boxes, `view.fit` and its `frameBounds` path, and the view loop. What is new: the four pieces above, and one performance test. `create-viewer.ts` (549 lines) gains about 30 lines; the cube and group building live in `preview.ts`. Libraries changed: `@ara3d/viewer-loaders` (two exports), `@bim-open-toolkit/formats`, `@bim-open-toolkit/viewer`. No new library.

Retires: nothing. The full load path stays and becomes the refinement. After P1, the pane's inline up-axis code can call `applyCoordinateConvention`, and the pane's `UNIT_CUBE` can use the viewer's `unitCube`. Both are recorded as debt, not done here.

## Considered and rejected
- **Option:** a decimated subset of real instances, such as the largest N meshes. **Reason:** it needs validated vertex and index buffers, normals, and per-mesh groups, which are the costs inside the 112 ms parse and the 1,966 ms first render. **Would change if:** a precomputed artefact carries a small decimated mesh set.
- **Option:** a precomputed preview sidecar written by `bos-to-bfast`. **Reason:** serving it needs the dev middleware in `bimopenflow/web/packages/app` (work in flight) and a new verified source/prepared hash pair. **Would change if:** the kill criteria trigger, or the app fence frees.
- **Option:** stream the BFAST and draw boxes before the download ends. **Reason:** the instance tables end at 101.6 MB of 111.6 MB, so the preview could start at 91% of the fetch, saving about 50 ms. **Would change if:** the converter writes `InstanceData`, `InstanceBoundsData` and `Meta` before `VertexData`. That changes the prepared hash, so it is an extension point.
- **Option:** fetch the instance tables with HTTP Range requests in parallel with the whole file. **Reason:** it depends on Range support in the app middleware, which is outside the fence. **Would change if:** the middleware supports Range.
- **Option:** build the preview inside the pane with its existing `setBoxes`. **Reason:** it puts load sequencing in TKT-16's fence and repeats the fetch-and-detect pipeline in each host. **Would change if:** never, while the showcase and graph demo share the pane.
- **Option:** draw every box, with no volume cap. **Reason:** Snowdon's largest box (46 × 112 × 64 m) and 19 others above 0.1% of the model's volume hide whole towers. **Would change if:** the C6 PNGs show the cap removing recognisable facade instead of hiding boxes.

## Signatures and contracts
Read-only for every chunk after the one that introduces them. These could not be compiled at planning time because the planner writes no files. The C2, C4 and C5 builders compile them first, as stubs.

```ts
// viz/packages/formats/src/preview.ts  (C2)
import type { Bounds, CoordinateContext } from '@bim-open-toolkit/model';

/** Floats per box in `BoxPreview.boxes`: min xyz, then max xyz. */
export const previewBoxStride = 6;

/** A coarse stand-in for a model: one world box per drawn placement, in source colour, built without reading geometry. */
export type BoxPreview = {
  /** `previewBoxStride` floats per box, world coordinates. */
  readonly boxes: Float32Array;
  /** RGBA per box, 0 to 1: the placement's source colour. */
  readonly colors: Float32Array;
  readonly count: number;
  /** Union over every placement the full model binds (alpha 0 included, hidden excluded), so a camera fitted to it stays put on refinement. */
  readonly bounds: Bounds;
  readonly coordinates: CoordinateContext;
  /** Drawn placements left out because their box exceeds `maxVolumeFraction` of the bounds' volume. */
  readonly oversized: number;
};

export type BoxPreviewOptions = {
  /** Defaults to `bfastCoordinates`. */
  readonly coordinates?: CoordinateContext;
  /** Default 0.001. Not applied when the bounds have zero volume. */
  readonly maxVolumeFraction?: number;
};

/** The box preview of a prepared BFAST. Raises a FormatError when the bytes are not a BFAST render model or its instance tables disagree in length. */
export function readBoxPreview(bytes: Uint8Array, options?: BoxPreviewOptions): BoxPreview {
  throw new Error('not implemented');
}
```

```ts
// viz/packages/loaders/src/index.ts  (C2, additive)
export { readBFast } from './bfast.js';
export { readRenderModelTables, type RenderModelTables } from './renderModel.js';
```

```ts
// viz/packages/formats/src/load.ts  (C3): added to LoadOptions
/**
 * Called once, after the bytes are in hand and before parsing, with a box preview when the format
 * carries one (a prepared BFAST). Awaited, so a host can draw it and let the browser present a frame.
 * A preview that cannot be read becomes a `formats/no-preview` warning; the load goes on.
 */
readonly onPreview?: (preview: BoxPreview) => void | Promise<void>;
// viz/packages/formats/src/diagnostics.ts: formatCode.noPreview = 'formats/no-preview'
```

```ts
// viz/packages/viewer/src/preview.ts  (C4)
import type { InstancedGroup, MeshBuffers } from '@ara3d/viewer-core';
import type { CoordinateContext } from '@bim-open-toolkit/model';
import type { BoxPreview } from '@bim-open-toolkit/formats';
import type { View } from './view.js';

/** Axis-aligned cube, edge 1, centred at the origin, flat-shaded: 24 vertices with normals, 12 triangles. */
export const unitCube: MeshBuffers = undefined as never; // builder: build it once at module load

/** Opaque boxes, then translucent boxes (each group omitted when empty), as unit cubes scaled to each box, with every axis at least 0.001 of the bounds' diagonal. */
export function previewGroups(preview: BoxPreview): readonly InstancedGroup[] {
  throw new Error('not implemented');
}

/** Puts a view in a model's frame: its coordinates, and an up vector of +z or +y to match. */
export function applyCoordinateConvention(view: View, coordinates: CoordinateContext): void {
  throw new Error('not implemented');
}

export type PreviewOptions = {
  /** Frame every view on the preview's bounds. Defaults to the viewer's `fitOnOpen`. */
  readonly fit?: boolean;
};

// viz/packages/viewer/src/create-viewer.ts: added to Viewer
/** Draws a box preview until the next `show` replaces it in the same call, or until disposed. Replaces any earlier preview. Submits a frame in every view before returning. Never picked. */
readonly preview: (boxes: BoxPreview, options?: PreviewOptions) => Disposable;
```

```ts
// viz/packages/viewer/src/load-with-preview.ts  (C5)
import type { Result } from '@bim-open-toolkit/model';
import type { BoxPreview, LoadedModel, LoadOptions, ModelSource } from '@bim-open-toolkit/formats';
import type { Viewer } from './create-viewer.js';

export type LoadWithPreviewOptions = Omit<LoadOptions, 'onPreview'> & {
  /** Called after the preview frame was submitted and before the browser is given a frame to present it. */
  readonly onPreview?: (preview: BoxPreview) => void;
  /** Frame the preview. Default true. */
  readonly fit?: boolean;
  /** Resolves once the browser has presented a frame. Default: one animation frame, then one task. */
  readonly nextFrame?: () => Promise<void>;
};

/** `loadModel`, drawing the source's box preview in `viewer` first. On success the preview stays until `viewer.show`; on failure or cancellation it is removed. */
export function loadWithPreview(viewer: Viewer, source: ModelSource, options?: LoadWithPreviewOptions): Promise<Result<LoadedModel>> {
  throw new Error('not implemented');
}
```

Names shared with the pane and the script:
- Performance marks: `bimflow:coarse-frame-submitted` (new) and `bimflow:first-model-frame-submitted` (unchanged; the full frame with the recipe).
- Coarse status text: `Coarse preview · loading full detail…`

## Extension points
- The converter writes the instance tables first, so a streaming reader can draw the preview before the download ends. This needs the prepared file to be regenerated and the middleware's hash pair updated.
- A precomputed preview sidecar served by the app, if the kill criteria trigger.
- A `maxBoxes` cap that keeps the largest boxes, if C6 shows the preview's own cost above 300 ms.
- Colouring the preview by recipe or category. This needs the entity metadata read (233 ms) before the preview.
- Worker-side parsing, so the page stays responsive during refinement. Today the main thread is held for about 4 s after the coarse frame.
- `viewer.open(source, { preview: true })` for hosts that do not transform the model between load and show.
- The viewer applying the coordinate convention on `show`, which would retire the pane's inline copy.
- The pane's `UNIT_CUBE` replaced by the viewer's `unitCube`.
- Picking or identity on preview boxes.
- Prepared normals and lazily built alternate representations to cut the full frame (`docs/bim-flow-startup.md`, item 1).

## Chunks
All paths are relative to `C:\Users\cdigg\git\bim-open-toolkit`. Test commands run from `viz/` unless they say otherwise.

| Id | One-sentence commit | Fence (writes only) | Depends on | Test command | Resources |
|---|---|---|---|---|---|
| C1 | Move the BFAST instance-record layout constants into formats' own layout module | `viz/packages/formats/src/bfast-layout.ts` (new, not re-exported from the index), `viz/packages/formats/src/bfast.ts` | - | `npm test -w @bim-open-toolkit/formats && npx tsc --noEmit -p packages/formats/tsconfig.json && npx eslint packages/formats` (existing tests pass unchanged) | none |
| C2 | Read a box preview from a prepared BFAST's stored instance boxes without touching its geometry | `viz/packages/loaders/src/index.ts`, `viz/packages/formats/src/preview.ts` (new), `viz/packages/formats/src/index.ts`, `viz/packages/formats/test/preview.test.ts` (new), `viz/packages/formats/test/fixtures.ts` (write real per-instance world boxes, as the converter does), `viz/packages/formats/docs/formats.md` | C1 | `npm run build -w @ara3d/viewer-loaders && npm test -w @ara3d/viewer-loaders && npm test -w @bim-open-toolkit/formats && npx tsc --noEmit && npx eslint packages/formats`. The tests cover the worked example, the cap, a short `InstanceBoundsData` raising, and Duplex: `samples/nrc/duplex-enriched.bos` (read-only) through `bosToBfast` gives a count equal to the drawn, alpha > 0 rows, and bounds equal to the union of the bound rows' boxes within 1e-4 relative. The Duplex test skips with a named reason when the file is absent. | none |
| C3 | Offer loadModel's caller a box preview after the fetch and before the parse | `viz/packages/formats/src/load.ts`, `viz/packages/formats/src/diagnostics.ts`, `viz/packages/formats/test/load.test.ts`, `viz/packages/formats/README.md` | C2 | `npm test -w @bim-open-toolkit/formats && npx tsc --noEmit && npx eslint packages/formats`. Cases: called once before the first `parse` event; awaited; not called for OBJ; an unreadable preview gives a `formats/no-preview` warning and an `ok` load; an abort during `onPreview` returns `formats/cancelled`. | none |
| C4 | Let the viewer draw a box preview that the next show replaces in the same call | `viz/packages/viewer/src/preview.ts` (new), `viz/packages/viewer/src/create-viewer.ts`, `viz/packages/viewer/src/index.ts`, `viz/packages/viewer/test/preview.test.ts` (new), `viz/packages/viewer/docs/viewer.md`, `viz/packages/viewer/README.md` | C2 (parallel with C3) | `npm test -w @bim-open-toolkit/viewer && npx tsc --noEmit && npx eslint packages/viewer && cd ../bimopenflow/web && npx tsc --noEmit -p packages/panes/tsconfig.json`. Fake-renderer cases: the worked example; every frame recorded from preview to show holds either the preview groups or the model groups, never neither; a later preview replaces an earlier one; dispose removes it; pick finds nothing; a view added later gets the preview. | none |
| C5 | Load a model with its box preview drawn and presented first | `viz/packages/viewer/src/load-with-preview.ts` (new), `viz/packages/viewer/src/index.ts`, `viz/packages/viewer/test/load-with-preview.test.ts` (new), `viz/packages/viewer/docs/viewer.md` | C3, C4 | Same as C4. Cases: the worked example with an injected `nextFrame`; after `show` and `view.fit`, the camera equals the preview's camera within 1e-6; a failed load and an aborted load both leave no preview groups; OBJ bytes give no preview. | none |
| C6 | Measure the Snowdon box preview and full frame in a real browser against the 2 s budget | `viz/packages/viewer/test/perf/snowdon-preview.perf.ts` (new), `viz/packages/viewer/test/perf/preview-page.ts` (new), `viz/packages/viewer/vitest.perf.config.ts` (new), `viz/packages/viewer/package.json` (a `perf` script) | C5 | `npm run perf -w @bim-open-toolkit/viewer`. It bundles the page as `test/browser/smoke.test.ts` does, and serves the page and `SNOWDON_BFAST_PATH` (default as in `formats/test/perf/bfast-versus-bos.perf.ts`) from a local HTTP server. It prints the ms from bytes in hand to the preview frame and to the full frame, plus `count` and `oversized`, and writes both PNGs under an ignored `artifacts/` folder. It skips with a named reason when there is no model or no browser. The builder compares the preview time with the kill criteria and reports before C8. | Snowdon file (read-only), Edge, one random local port |
| C7 | Report the coarse and the full frame against the 2 s target in the startup profile | `scripts/profile-bim-flow-startup.mjs` (needs question 5's fence widening) | - | `node --check scripts/profile-bim-flow-startup.mjs`, then after P1 `node scripts/profile-bim-flow-startup.mjs` prints the fields in question 5 | editor on 5300 and host on 5214 for the full run |
| C8 | Log Snowdon's coarse and full frame times against the 2 s target | `docs/bim-flow-startup.md` (new dated section; update "Remaining opportunities" item 2), `docs/bim-flow-3d.md` ("Limits": the preview is boxes in source colours with no picking or recipe until full detail; the thread is held during refinement; BOS bytes get no preview) | C6, C7, P1 | One discarded warm-up, then three runs of `node scripts/profile-bim-flow-startup.mjs` with `BOF_DEMO_URL` set; the three JSON results are quoted in the section | editor on 5300 and host on 5214, with the Snowdon store; not while another chunk holds these ports |

P1 (the pane wiring, question 1) sits between C5 and C8. It is not a chunk of this plan until its fence is granted.

Baseline gates (2026-09-26, before any change):
- `npm test -w @bim-open-toolkit/formats`: 13 files, 191 tests passed.
- `npm test -w @bim-open-toolkit/viewer`: 9 files, 96 tests passed, including the browser smoke.
- `npx tsc --noEmit` at `viz/`: clean.
- `npx tsc --noEmit -p packages/formats/tsconfig.json` and `-p packages/viewer/tsconfig.json`: clean.
- `npx eslint packages/formats packages/viewer`: clean.
- From `bimopenflow/web`: `npx tsc --noEmit -p packages/panes/tsconfig.json` is clean, and `npm test -w @bimopenflow/panes` passes 14 files and 130 tests.
- Not run: `node gates/web-smoke.mjs`, because the app package has uncommitted in-flight edits.

## Build log
| Id | Commit | Result |
|---|---|---|
| C4 | e1f2046 | viewer 103 tests pass, tsc and eslint clean, panes typecheck clean; fence respected (6 files). Picking excluded by construction: preview groups never go through binding.addModel. |
| C3 | e64a7d0 | formats 199 tests pass, tsc and eslint clean; fence respected (4 files). |
| C2 | 0bb7cc7 | loaders 34 and formats 195 tests pass, tsc and eslint clean; fence respected (6 files). Finding: on Duplex the default 0.001 volume cap drops 41 of 660 boxes, so the Duplex count test disables the cap; the cap is tested on a synthetic fixture. |
| C1 | 903d9d8 | 191 formats tests unchanged, tsc and eslint clean; fence respected. |
| C7 | ff58478 | node --check passes; servers not running so no live run. Finding: the script navigates to /3d.html?profileStartup=1 without analysis=snowdon-toolkit; the plan's 'as today' was wrong; the profiling host serves that analysis by default, so the parameter is redundant. |

## Review findings

## Debt and extension points

## Report
