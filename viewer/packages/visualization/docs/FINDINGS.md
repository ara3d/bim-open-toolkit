# Verification findings — September 7, 2026

This continuation implements a composable alpha with23 independent gallery routes. It does not claim the entire product brief or V1 release acceptance. Snowdon is the primary integration fixture; private model/projection data remains outside the distribution.

## Loading defect and prevention

The reported ZIP error came from HTTP200 HTML served at the model endpoint because Vite did not select the example configuration. The npm demo commands now name that config explicitly. The loader rejects HTML and non-ZIP signatures before decompression, and the gallery shows model, initialization and rendering failures prominently with retry actions.

The local HTTP smoke checks the exact served bytes against the original file, SHA256 metadata and decoded geometry. A separate opt-in normalization gate checks every representation binding, source ID, transform, index, color and normalized bound. It exercises real cooperative cancellation and rejects malformed data without partial publication. A separate loading-checks gallery route demonstrates expected HTML/truncated ZIP/pre-abort rejection.

Source file:9,362,255 bytes; SHA256 `fc31c4463d9eb958ae8de3d853cfc8224b9469477b419857fbc929956c9cc51d`. Actual normalized result:51,139 logical objects,456,598 rendered instances,158,055 groups and6,185,680 displayed triangles.28,976 objects have no normalized render bindings; that includes source-hidden geometry skipped by the converter and must not be described as proof that every such source entity never had geometry.

The BuildingModel projection resolves142 doors against that exact source fingerprint. Nominal widths:141 known and1 conflicting; clear widths:0 known and142 missing. The adapter preserves evidence and missing reasons and makes no compliance inference.

## Unit, type and package gates

| Gate | Actual result |
|---|---|
| Full core suite |70 passed /10 files, including batch rendering, indexed normals and renderer teardown |
| Full controls suite |32 passed /5 files, including touch/cancel and batched picking/sectioning |
| Full loaders suite |25 passed /4 files |
| Full visualization suite |144 passed /25 files; excluded only the separately executed opt-in Snowdon integration test |
| Total ordinary tests |271 passed |
| Full workspace build |Passed pinned Gratify, core, controls, loaders and visualization in dependency order; affected packages rebuilt after later fixes |
| Strict gallery typecheck |Passed including React TSX and every feature route |
| Production gallery build |Passed;1.20MB uncompressed entry chunk,380KB gzip; code-splitting remains an optimization |
| Actual normalized Snowdon |Passed all geometry/identity/binding/bounds/cancellation assertions |
| HTTP Snowdon smoke |Passed exact original bytes/hash, JSON metadata and archive decode |
| Generated API |12 public entrypoints generated; all declared JS/type files exist |
| Root boundary |48 runtime exports across17 local modules; zero external runtime imports; import succeeds with DOM getters throwing |
| Packaging |Dry-run passed:137 files, generated API included; no private model/projection/artifact files |

The actual normalization gate took20.94s total under concurrent development load:5.52s for an aborted load and8.52s for a successful normalized load. Host: Windows10.0.26200, Intel Core Ultra7 155H, Node22.13.1. These are one-sample CPU timings. ZIP/column parsing is still synchronous before the normalization yield; worker-based interruption remains deferred.

## Browser evidence and performance

The original in-app browser successfully rendered full Snowdon. Visually checked source colors, category tint,18% ghosting, axis/box clipping and edit selection→move→undo. No errors occurred in those checks.

Measured10,000 distinct represented objects,5 warmups and20 changing samples, nearest-rank percentiles, full Snowdon loaded. In-app Chromium152 on Windows,980×658 viewport/drawing buffer,DPR1. GPU model/driver/presentation timing were unavailable.

| Operation | CPU p50 / p95 | Command to next RAF p50 / p95 |
|---|---|---|
| Color, before targeted optimization |297.50 /434.40ms |955.40 /1095.40ms |
| Color, after optimization |271.20 /316.20ms |855.50 /956.20ms |
| Visibility, after optimization |262.00 /304.80ms |597.20 /811.60ms |

The optimization avoids unchanged color uploads, unnecessary matrix multiplication and repeated buffer-view/callback allocations. Tests preserve nonidentity composition and externally changed source buffers. These measurements include explicit rendering but do not establish GPU completion, visible-pixel latency, sustained30FPS, or10-million-triangle acceptance.

Repeated development reloads eventually caused the in-app browser to refuse new WebGL contexts, including the tiny fixture. The application now distinguishes graphics initialization from model loading, reports context loss, disables disposed controls, performs best-effort cleanup and exposes reload. Viewer disposal releases its WebGL context explicitly and ignores later frame requests. Existing browser-process graphics availability is external to that cleanup; automatic context reconstruction is not claimed.

An isolated headless Edge152.0.4191.66 process successfully creates WebGL2 with ANGLE SwiftShader. The repeatable browser-smoke suite uses this software renderer for functional checks and writes per-case JSON/screenshots into ignored artifacts. It does not supply hardware performance numbers. All12 scenarios passed across the full run plus one targeted rerun after correcting a missing favicon404. The full run passed11 feature cases; expected loading failures also behaved correctly, but its strict console gate caught the favicon. The targeted loading-checks rerun passed after adding an inline icon.

## Composition and remaining scope

The root API remains data-only; renderer/loading/capture/Gratify adapters are explicit optional subpaths. Host callbacks own persistence/network/application effects. Actual React and Gratify examples use the same identity, selection, styling and persistence modules. Gratify's pinned package resolves in Vite; native Node import of its extensionless directory exports fails upstream. That optional adapter is currently browser-bundler qualified, not native-Node qualified.

SceneDocument schema1 does not yet store clipping, environment, overlays or replacement buffers. Text annotations have their own validated schema; replacement geometry uses a separate reversible transaction. Orthographic fixed views are implemented; first-person navigation and hardware-mobile qualification remain. Two-view support has independent/linked cameras, not all shared-state combinations. Assistant tools expose validated bounded MCP-style descriptors/results and host commands; external MCP transport is deferred.

Maps/georegistration, tracing/simulation, mesh-derived voxel occupancy, LOD, richer markup, four views, full Gratify theming and additional BuildingModel recipes are postponed. They are not implied by the working foundation. The React example demonstrates a real source-backed review application but does not satisfy every release-level reference-app criterion.

## Repository state

All work stays on the existing main branch. Agents committed their scoped verified increments under serialized turns. Coordinator owns the integration commit, generated reference and final findings. The pre-existing unpublished foundation commit is not silently pushed together with this work. No remote publication is claimed.

## Final browser acceptance matrix

| Fixture | Verified behavior |
|---|---|
| Snowdon | Category styling/ghost/reset; select/move/undo; axis clipping/clear/reset; replacement/undo;142-door exception evidence and save/restore; React actual-fact selection/filter; PNG thumbnail decode |
| Small fixture | Three loading-failure checks; Gratify command dispatch/reset; orthographic projection/restore; add/link/remove/re-add comparison view; uniquely named local save/load/delete |

The isolated suite reports every case and saves screenshots in ignored `artifacts/browser-smoke/`. The loaded Snowdon screenshots were inspected; the building and source-backed React table render correctly. Software-rendered Snowdon cases took33–62 seconds each and are not comparable to the earlier hardware/in-app latency observations. Cases use separate pages and deterministic teardown to bound resources.

Final source inputs: all agent commits through `0863ea0` plus the coordinator integration file set. All writers/processes affecting test inputs were stopped before their respective final gates. Changes after broader tests were scoped fixes with affected tests/typechecks/browser cases rerun; the favicon change reran its failing case and production build. Documentation-only evidence updates do not alter runtime inputs.

## September 7 Snowdon performance follow-up

[Detailed experiment and limits](snowdon-performance.md) supersedes the earlier unqualified navigation-performance observations for one named local profile. Hardware-accelerated Edge/Intel Arc measured median RAF intervals of 316.7 ms before optimization and 12.5–12.6 ms after packed opaque geometry plus revision-based mirror synchronization (final p95 16.7 ms). This is scheduling evidence, not measured presentation latency or multi-device release qualification.

Full source hash/count verification, six rendered-image comparisons, and five-warmup/twenty-sample 10,000-object updates passed. The final update p95 command-to-next-RAF observations were 191 ms color, 200 ms visibility, 655 ms transforms and 295 ms ghosting. Packed buffers add approximately 257 MiB of CPU arrays and corresponding GPU buffers; a public opt-out preserves the lower-memory path. Full transparency and changed-scene scans remain optimization opportunities.

The dependency build, production gallery build, strict example typecheck and 278 tests passed (one pre-existing optional integration test skipped). The production build retains its large-bundle warning. The 77 core tests include the new packing, update, fallback, disposal, multi-mirror and revision checks. Generated visualization reference remains unchanged after regeneration. Immutable planning baseline checks pass.

Five additional gallery scenarios passed on hardware WebGL: Snowdon appearance/ghost/reset, select/move/undo, clipping/clear/reset, replacement/undo and PNG thumbnail decode. The resulting appearance screenshot was inspected. Repeat with `BROWSER_RENDERER=hardware` and `BIM_BROWSER_CASE=Snowdon` when invoking `scripts/browser-smoke.mjs`; its default remains software WebGL for functional isolation.

Rendering source is committed through `dfe2688`; the final harness/documentation changes add verification and evidence. Separate gallery resize edits appeared in the shared checkout during final verification and are outside this performance change. The isolated benchmark does not import the affected gallery modules. Performance commits remain local: automatic approval review rejected publication to the shared remote main branch.
