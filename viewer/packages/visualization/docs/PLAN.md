# Visualization foundation wave

Implement the fastest useful review foundation from the September 7 product brief. This is an incremental alpha, not all P0 release requirements. Shared checkout: `C:/Users/cdigg/git/bim-open-toolkit`; initial tree clean. No applicable ancestor AGENTS.md was found. Parallel Wave and Platonic Coder apply.

## Decisions and contracts

V1: `src/contracts.ts` is the stable shared contract. Model IDs identify a loaded revision; source references retain explicit revision. Object keys encode the pair without delimiter collisions. Geometry-free objects are valid. Representation bindings stay in the render adapter, outside saved data. Matrices are column-major; colors linear; unknown units/registration remain explicit. Borrowed mesh buffers stay owned by the host/core. Do not mutate model input records.

Reuse existing MIT viewer core, controls and loaders; preserve notices. No new renderer or duplicate Three dependency. Core root export is DOM/renderer-free; render adapter is an opt-in subpath. Existing BOS entity mapping requires explicit host normalization/bindings. No geometry-only BIM facts are invented. Audit found that existing loader progress does not include cancellation; F02 cancellation remains deferred.

Composition: base -> enabled edit layers in order -> ordered workflow rules -> view filter -> transient selection color. Delete is a tombstone for that composition; selection/filter/rules cannot resurrect it or an explicitly hidden object. Later deliberate edit visibility may override earlier visibility. Undo is one complete edit-layer transaction. Saved schema v1 contains references and plain data, never runtime meshes/credentials. Host resolves models and reports missing/revised objects. Gratify submodule is unchanged; release consumption and accessible/mobile UI remain deferred.

Dependency graph: contracts -> [identity/selection, appearance/edits, persistence]; contracts + viewer-core -> render binding; all verified modules -> public API demo + integrated checks.

## Ownership and acceptance

Supervisor owns all unassigned files, contracts, index exports, package manifests/lockfile, render adapter/tests, examples, README, this plan, final findings and Git publication. No shared port until supervisor starts demo server. Agents use isolated test cache directories if needed, no installs/builds or whole-repo formatting. Only supervisor builds the package after writers stop. Commit turn starts with supervisor; later one explicit grant at a time.

| Track | Exact writable paths | Acceptance / readiness | Focused gate |
|---|---|---|---|
| identity | src/identity.ts, src/selection.ts, test/identity.test.ts, test/selection.test.ts, docs/identity.md | V1 read; multi-model lookup, geometry-free records, immutable set operations, one event per real selection change, disposal | vitest run test/identity.test.ts test/selection.test.ts |
| appearance | src/appearance.ts, src/edits.ts, test/appearance.test.ts, test/edits.test.ts, docs/appearance.md | V1 read; category/numeric mapping with missing values, precedence, tombstones, transaction undo/redo, no base mutation | vitest run test/appearance.test.ts test/edits.test.ts |
| persistence | src/persistence.ts, test/persistence.test.ts, docs/persistence.md | V1 read; validated JSON round trip, reject unsupported/malformed data, host resolution with cancellation and diagnostics | vitest run test/persistence.test.ts |
| supervisor | remaining paths | public API, rendering bindings and small standalone review demo; combined build/tests | workspace builds/tests, demo smoke if browser available |

Each agent owns its docs checkpoint and records state, checks, running processes, findings and commit hash there. Read-only inputs: contracts and existing packages. Test caches must be private per track; no nested agents needed. Local gates may overlap only against stable owned inputs. Readiness requires acknowledging V1. Return commit request after tests; pause writes when requested. Expected findings do not authorize scope expansion.

## Milestones and deferrals

1. Foundation contracts + package scaffold verified and committed.
2. F01/F07 identity and sets; F08/F15 pure appearance/edit subset; F17 saved data subset independently verified and committed.
3. F03 scoped bulk renderer binding, F06 identity hit resolution, deterministic public API demo, documentation and integrated verification.

Full feature completion still requires browser integration, generated reference and relevant performance gates. Defer additional formats, orthographic/first-person controls, mobile, Gratify shell, React application, clipping persistence, geometry replacement, overlays/markup, map/MCP, tracing, LOD and specialist workflows. Existing primitives do not establish those product features as complete. No aggressive replacement agents for expensive/blocking work.

## Benchmark protocol

Measure pure 10,000-object updates separately from rendering; record warmup/sample count and p50/p95, never describe CPU submission as display latency. Browser gate needs named OS/CPU/GPU/browser/viewport/DPR, deterministic camera path and declared triangles/instances. Target 30 FPS and p95 <1 second submit-to-visible bulk update; no guarantee until measured. Snowdon remains an external private fixture: record hash/counts without distributing it. Hardware/mobile, GPU memory and Snowdon benchmarks remain unresolved if unavailable. Do not block useful data-layer work on them.

Baseline and integration results are recorded in FINDINGS.md. Source changes after gates invalidate affected verification. Supervisor checks stopped writers and final Git status before integrated gates.

## Next gallery wave

Build a shared gallery index and minimal fixture/reset harness first. Then reuse three agent slots for independent routes: selection/picking; appearance/edits; persistence. Keep host shell, registration and fixtures supervisor-owned. Each route should show its public API source, limitations and verification command; tests stay alongside the owning feature. Add bulk-update timing as a separate route with explicit CPU/display separation. Current delivery contains one combined review demo, not this gallery. This plan does not claim those routes already exist.
