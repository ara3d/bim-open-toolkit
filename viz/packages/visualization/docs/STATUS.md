# Visualization implementation status

Recorded 2026-09-07 after implementation commit 6539fe9. This is the prioritized alpha status, not the original product specification. Read [PLAN.md](PLAN.md) for requirements and delivery intent, and [FINDINGS.md](FINDINGS.md) for verification evidence. No feature implementation tracks are currently active. The latest follow-up restores planning context and reconnects the gallery; it adds no product features.

The former plan is preserved exactly in the planning history. Its status content follows, with the obsolete active-track label corrected.

September 7 performance follow-up: [Snowdon frame investigation](snowdon-performance.md) records an approximately 25-fold improvement in median navigation-frame intervals on the named Intel Arc/Edge profile. Small opaque surfaces use bounded packed meshes; source identity, shared source geometry, picking and transparent fallback remain. Scene revisions skip unchanged-model scans. This is local F03/F27 evidence, with memory, transparency, mobile and presentation-timing limits retained.

## Current direction

September 7 BFAST follow-up: [prepared-model loading evidence](bfast-loading.md)
records signature-based BFAST support through the existing BOS APIs, a local
gallery fixture choice, exact-source Snowdon geometry parity and browser checks.
The small CPU sample shows about 3.5× faster parsing plus group conversion;
larger transfer size, absent property/source-ID tables and synchronous parsing
remain explicit limits. This extends F02 without closing its remaining gates.

September 7 combined-container decision: the user requested original BIM Parquet
files alongside prepared geometry. The converter now preserves every Parquet
entry under `BOS/`; loading restores all entity rows/source IDs and exposes
on-demand table reads. The absent-table limitation above now applies only to
legacy geometry-only BFAST. Original evidence remains in [the dated record](bfast-loading.md).

Continue the authorized implementation through useful independent increments. Snowdon is the primary integration fixture. Each feature has a small demo viewer, reset/cleanup behavior, focused tests and explicit limitations. Keep all three subagent slots occupied when independent work is ready; coordinator owns integration, browser validation and plan updates. Postpone high-cost specialist features rather than compromising the common foundation.

Skills: Parallel Wave and Platonic Coder. Shared checkout on main; preserve the pre-existing unpublished foundation commit. Agents commit only owned files under serialized commit turns. Publication must not accidentally include unrelated history. No private model/projection data enters the distribution.

## Stable contracts and ownership

- V1: src/contracts.ts. Identity is model revision plus object ID. Geometry-free objects remain valid. World matrices are column-major. Units and unknown values stay explicit. SceneDocument schema1 holds references/plain data, never renderer objects.
- Composition: base → enabled edit layers → ordered workflow rules → filter → transient selection. Selection cannot resurrect hidden/deleted geometry. Replaceable geometry has a separate ephemeral transaction until a deliberate saved-schema migration.
- G1.1: examples/gallery/contracts.ts. One shared host supplies model, base records, viewer, controls, rendering, selection, panel, buttons, status, update/reset/fit. Each FeatureDemo mounts and returns cleanup. Hosts own model resolution; features own only their subscriptions and temporary resources.
- Core rendering: SceneObject uses bounded batches above1,000 groups, with packed small opaque meshes and Three BatchedMesh for transparent fallback/picking. `Viewer({ packedGeometry: false })` selects lower mirror memory. RenderBinding supports per-representation transforms/colors and overlay pick providers. Borrowed geometry membership stays stable while bound.
- Projection addition: Viewer retains its perspective camera; renderCamera/setRenderCamera adds an optional render override. Coordinator routes picking through the actual render camera.
- Coordinator exclusively owns manifests/lockfile, public exports, gallery host/index/style, local fixture server, shared build outputs, port5173, test browser tab, generated reference and aggregate findings. No agent installs dependencies or runs shared builds. Scoped tests may overlap only against stable inputs.

| Last completed track | Exclusive writable paths (under visualization unless stated) | Acceptance |
|---|---|---|
| Orthographic | core/src/viewer.ts, core/test/viewer.test.ts; src/projection.ts, test/projection.test.ts, examples/features/projection.ts, docs/projection.md | Backward-compatible override, aspect-correct fit/resize, independent fixed-view demo, restore on disposal |
| Storage | src/storage.ts, test/storage.test.ts, examples/features/storage.ts, docs/storage.md | Injected storage, versioned namespace, explicit save/load/delete, no implicit overwrite, actionable errors |
| Assistant tools | src/review-tools.ts, test/review-tools.test.ts, examples/features/assistant.ts, docs/review-tools.md | Bounded read/write tools, revision/reference validation, no arbitrary execution, host-owned effects; MCP transport separate |

Each track reads applicable skills and acknowledges shared contracts before editing. Commit turn includes index inspection, explicit staging, staged review and commit completion; no other writer stages meanwhile. On completion, assign a ready bounded task or independent review. Contract changes require affected writers to pause and acknowledge. Source changes invalidate affected checks.

## Implemented increments and remaining qualification

| Area | Implemented and locally tested | Remaining qualification or scope |
|---|---|---|
| F01/F02 | Model registry, source identities, geometry-free records; normalized BOS; GLB/glTF/OBJ/STL subsets; progress and cooperative normalization cancellation | Synchronous ZIP/column decode can still block; geometry-first property streaming and context recovery deferred |
| F03/F06 | Batched large scenes, bulk color/visibility/transform, nearest visible/clipped identity hits, replacement pick providers | GPU/display completion unmeasured; acceleration and context recovery deferred |
| F04/F05 | Perspective fit/saved poses, limits, touch orbit/pan/pinch, pointer cancellation; fixed orthographic views | First-person and real mobile qualification remain |
| F07/F08/F15 | Selection/set operations, linked table, category/numeric styling with explicit missing colors, reversible edit layers/undo/redo | Query language, outlines and full geometry edit histories deferred |
| F09 | Optional real Gratify public-API controls with complete teardown, native HTML equivalents and a React door-review application | Full Gratify shell/theming and broader reference-app qualification remain |
| F10/F11 | Background/simple light rigs, axes/grid/bounds; object/instance/triangle counts | FPS/GPU timing HUD and room/level navigation remain |
| F12/F13 | Plane/box clipping, reversible exploded/grid layouts | View-state persistence for clipping; manipulators and richer regions deferred |
| F14 | Separate GPU mirrors and independent/linked cameras in two-view demo | Shared selection/clipping controls, four views and cross-revision correspondence deferred |
| F16 | Replace a source object by a separate mesh while retaining identity; undo restores source without rebuilding batch geometry | Full geometry chains, persisted replacement buffers, LOD deferred |
| F17 | Strict saved schema, reference resolution/cancellation, local source fingerprint and explicit injected storage | Complete environment/clipping/overlay state schema remains |
| F18/F19/F20 | World-point/text notes, standalone validated annotation JSON, overlay cleanup, PNG capture/preview | Occlusion/measurement markup, drawing and unified persistence deferred |
| F21 | Timestamp-driven playback and single-object animation; no idle RAF | Rich timeline authoring deferred |
| F23 | Validated bounded assistant-tool registry and command demo | External MCP transport/deployment separate; no claim of live assistant connection |
| F26 | Actual BuildingModel door schedule:142 exact identities;141 known/1 conflicting nominal widths;142 missing clear widths; evidence and coverage | Additional recipes, nominal→clear inference and compliance verdicts excluded |
| F27 | Independent gallery, per-feature source/test links, strict demo checking, local Snowdon regression, benchmarks | Generated reference complete; final browser evidence in FINDINGS.md |

F22 map/georegistration, F24 tracing/simulation and F25 mesh-derived voxels are postponed: high cost, weak dependency on the current review foundation. A bounds-only voxel preview is optional after primary gates, never a substitute for verified occupancy.

## Snowdon regression and verification

The reported ZIP failure was HTTP200 HTML fallback because Vite did not load the example config. The demo script now selects that config explicitly. Loading rejects HTML and non-ZIP responses before decompression; model failures show a prominent alert and retry. Global runtime errors and rejected button actions surface visibly. The metadata fetch has a timeout.

Primary source: external Snowdon Towers Sample Architectural.bos,9,362,255 bytes, SHA256 fc31c4463d9eb958ae8de3d853cfc8224b9469477b419857fbc929956c9cc51d. Decoded source instances471,462; rendered instances456,598; groups158,055; entity rows51,139, with28,976 lacking normalized rendered bindings; displayed triangles6,185,680. Geometry chunks and offsets were audited against decoded metadata. Private BuildingModel projection is served through one fixed local-only endpoint.

Required acceptance sequence:

1. Agents finish writes/processes; coordinator finishes exports, generation and integration. Record stable input revision plus reviewed uncommitted set.
2. Build pinned Gratify and workspace dependency order; run focused/source tests, strict demo check, production demo build and package dry-run.
3. Run demo:snowdon against the real dev server: require MIME/ZIP signature, byte-for-byte source hash, matching metadata and nonempty decoded geometry.
4. Exercise Snowdon feature actions in dedicated browser tab, including errors, reset and representative lifecycle. Record actual browser behavior separately from unit tests.
5. Measure10,000 distinct represented objects with5 warmups/20 samples, p50/p95 CPU submission separately from command-to-next-RAF. Never claim GPU/presentation latency from RAF. Report actual viewport/browser and unavailable hardware metrics.
6. Update findings/feature matrix, review diffs, commit integration under its exclusive turn. Later source edits rerun affected gates. Do not call complete product release acceptance while known gates or scope remain.

Browser evidence already obtained: full Snowdon renders; category tint and18% ghosting visibly work; plane/box clipping works; selection→move→undo restores transaction state without errors. That earlier integration validation is superseded by the final verification record below and FINDINGS.md. First submitted frame observations varied with concurrent work; no opening-time guarantee is claimed.

## Final verification wave

Implementation tracks are complete for this prioritized alpha. Coordinator owns final integration; agents independently authored browser scenarios, reviewed lifecycle/data flows and verified core/controls/visualization tests. The isolated browser suite contains12 scenarios (Snowdon primary, small fixtures for controls and negative cases). Software WebGL keeps functional checks independent of the in-app browser graphics-process failure; hardware performance observations remain separately labeled.23 gallery routes now include a dedicated loading fault-check viewer. Final totals, package evidence and limitations live in FINDINGS.md. No worker/source writes may overlap final relevant gates.
