# Notes — findings that must feed back into the design

Agents: append findings here (contract friction, surprises, perf numbers).

## Contract changes
(record any edits to supervisor-owned files here)

## Findings

### Track A (tiers 0-1)
- PLAN.md §1 is wrong that Plato.Generated/Plato.Intrinsics are "not referenced by anything moving": Ara3D.Geometry imports both as shared-source projects (.projitems), and PropKit/DataTable/Models depend on Geometry. Supervisor vendored both into src/ (compile-into-consumer only, no extra assemblies).
- The 11 tier 0-1 projects have zero PackageReferences — no central-version gaps.

### Track B (tier 2)
- Ara3D.Ifc.Editing needed eight files, not six: IfcGuid.cs and IfcStepText.cs are required helpers. Namespace kept as Ara3D.Ifc.Tests (rename is a follow-up). net8.0-windows/x64, forced by Ara3D.IfcLoader's native web-ifc dll (fix-on-entry item 6 would relax this).
- web-ifc-library.dll (native) now lives inside src/Ara3D.IfcLoader (was in sdk vendor/); consider LFS or a nuget-packaged native asset later.
- Microsoft.Data.Sqlite was hardcoded in origin; now centralized as Ara3DMicrosoftDataSqliteVersion.
- Ara3D.Ifc.Mesher carries PROGRESS.md + 17 WIP progress-notes docs — pruning candidates.

### Track D (PlatoFlow)
- Acceptance met from this repo + submodule alone: npm install/build/check clean; vitest 997/997; intgate-smoke 13/13 with host converting repo data/duplex.ifc.
- edgate-smoke "picker opens over clicked row" fails identically in the origin repo — pre-existing upstream defect, not a copy regression.
- Host still source-links src/Ara3D.Ifc.Mcp/IfcDuck.cs — repoint when fix-on-entry item 2 moves CreateViews into BimOpenSchema.IO.
- Default demo model is now duplex.ifc; Snowdon/rac_basic models load via PLATOFLOW_EXTRA_DATA env var (not shipped).

### Supervisor / SDK-boundary restructure (2026-08-30, evening)
- Reversed the tier 0-1 vendoring per user direction: general-purpose SDK projects (Utils, Memory, Collections, Logging, F8, PropKit, Geometry, DataTable, Models, IO.BFAST, IO.StepParser, IO.GltfExporter, IO.SharpGLTF, Ara3D.MCP, Plato.*) removed from src/ and consumed as NuGet packages from a local vendor/ feed (nuget.config), packed from ara3d-sdk @ 82df7322.
- Vendored packs are versioned 1.6.2-local, NOT 1.6.1: nuget.org's 1.6.1 has older content (no SimpleHttpServer in Utils) and the global package cache resolves by id/version, so a same-version vendor pack silently loses. Never vendor a version nuget.org also serves.
- tests/Ara3D.MCP.Tests removed (its subject stays in the SDK). Test count 175 -> 126, all green. Full sln builds 0 errors.
- Earlier wave close-out claimed "BimOpenToolkit.sln builds 0 errors" but the committed sln was EMPTY - the shproj crash during `dotnet sln add` rolled back the whole batch, and building/testing an empty sln trivially succeeds. The per-project test runs were the real gate. Sln now actually contains the 13 projects; lesson: verify sln contents, not just exit codes.

### Supervisor / wave close-out (2026-08-30)
- Full gate green: BimOpenToolkit.sln builds with 0 errors; 175/175 tests pass across 6 suites; platoflow web builds and its gates pass.
- .shproj shared projects (IfcTypes, Plato.*) are not in the .sln (dotnet CLI can't add them); they compile into consumers via .projitems, so builds are unaffected. Add via VS if IDE browsing is wanted.
- Test data is never committed; data/get-test-data.ps1 copies the IFC Test Kit from ../nrc-ifc-llm and sample models from ../studio/ara3d-sdk/data.
- Postponed per user: Revit exporter (tier 6), Phases 5/7, most §5 fix-on-entry items (1, 2, 4-8).

### Track C (tiers 3-4)
- BLOCKER: tests/Ara3D.BimOpenSchema.Tests references `..\..\src\Ara3D.IO.SharpGLTF\Ara3D.IO.SharpGLTF.csproj` (used by GltfMaterialFactory.cs / GltfDemo.cs). Ara3D.IO.SharpGLTF is not in any track's fence and is missing from src/ — build fails with CS0246 until it is copied (source: ara3d-sdk/src/Ara3D.IO.SharpGLTF).
- data/get-test-data.ps1 clobbers data/README.md: `Copy-Item IFC-Test-Kit\* data\` overwrites the repo's data/README.md with the test kit's README. Restored via git checkout; script should exclude README.md.
- get-test-data.ps1 fetches only the IFC Test Kit. Harmonizer/Mcp/BimOpenSchema tests additionally need (from ara3d-sdk/data): AC20-FZK-Haus.ifc, AC20-Institute-Var-2.ifc, model_0.ifc, schependomlaan.ifc, rac_basic_sample_project-2025.bos. Copied locally (gitignored) to verify; script should be extended.
- Ara3D.Ifc.Editing shipped IfcStepText.cs and IfcGuid.cs in addition to the six promoted files; deleted the test-side copies/links to avoid CS0436 duplicates.

## Findings — BimOpenFlow rewrite waves 0–3 (2026-08-31)

### Track SPEC (spec/dataflow-graph)
- Graph hash covers canonical bytes of {"structure","values"} only; formatVersion/layout/session excluded — canvas edits never change analysis identity. One hash style everywhere: bare lowercase hex SHA-256.
- Hash-bearing conformance expectations ship as "TBD-by-engine"; the conformance suite freezes them from the first canonical engine run; after that a changed hash is a breaking change by definition.
- Node ids may not contain dots (dot is the endpoint separator); kind ids need >=2 dotted segments — the namespaces cannot collide.
- The conformance harness contract (per-step execution counts, effect order, test.* vocabulary) is part of the spec, so "memoization works" is a black-box assertion.
- PoC-format migration tooling must handle three renames: {node,slot} objects -> "nodeId.port" strings, kindVersion -> version, wires -> edges.
- and/or are NOT short-circuiting (null-propagation rule wins); only ?: is lazy.

### Track NG (Ara3D.NodeGraph) — 44 tests
- Param values are canonical strings; typed-JSON values were a spec drift, reconciled back.
- Graph hash: plain lowercase hex, hash input has no trailing LF; document text ends with exactly one LF.
- No Integer->Number widening at edges (deferred deliberately; expressions widen internally).
- Canonical writer is two-stage (loose JSON -> sorted canonical text), so future layers serialize canonically for free; nodes sort by id, edges by "to".

### Track EXP (Ara3D.DataFlowEngine.Expressions) — 422 tests
- Conformance runner auto-discovers spec/dataflow-graph/expressions/conformance/*.json; all 14 vectors pass; new vectors run with no test changes.
- Pinned where sources were silent: round digits 0..15; long.MinValue % -1 == 0; keywords/builtins lowercase case-sensitive; text ordering by Unicode code points.
- Checker environment is scalar-only; spec allows Any/Table bindings — needs a decision when node packs bind tables.
- Quoted identifiers are never calls; bare `len` is usable as a column name.

### Track DUCK (Ara3D.BimOpenSchema.DuckDb) — 11 tests
- FIXED (2026-08-31): SDK's ToDataTable encodes enums by POSITION in Enum.GetValues; the `Bool = Int` alias in ParameterType made positional codes disagree with numeric values, shifting stored ValueType codes +1 for values >= 1. Fixed by removing the alias (positions now equal values); ParameterType must stay contiguous from zero with no aliases. Regression tests: ParquetParameterTypeTests (schema tests) and ParquetDerivedDatabase_LabelsValueTypesCorrectly (DuckDb tests). Migration: .bos files exported before the fix still carry shifted codes (Number->2, Entity->3, String->4, Point->5) and must be re-exported; bfast files were never affected (raw struct bytes).
- net8.0-windows forced by BimOpenSchema.IO (via IfcLoader); true DuckDB isolation needs IO's windows-only parts split out later.
- Jsonable coercion + tool-error hints deliberately left in the MCP layer; repoint of Ara3D.Ifc.Mcp is clean and mapped in the track report.
- Shared-worktree incident: an --amend raced another track's commit and rewrote it; f66e52d carries ~2.5MB bin/obj blobs in history (HEAD clean). Rule reinforced: never amend on a shared worktree.

### Track VCORE (@ara3d/viewer-core) — 37 tests
- Loader contract: InstancedGroup.append(transforms 16 floats col-major, colors RGBA 4 floats) -> startIndex; renderer sync is pull-based via version counters.
- Per-instance alpha not rendered yet (three instanceColor is RGB); group opacity works; TODO in group-object.ts.
- Capacity growth rebuilds the InstancedMesh — consumers must hold GroupObject.root, never cache .mesh.
- three peer range >=0.180.0; workspace devDep three ^0.185.0.

### Track VIZ (@bimopenflow/viz) — 25 tests
- Contracts imports are type-only, so the IIFE bundle (8.8KB minified) has zero runtime deps — small enough to inline into generated dashboard HTML. Keep @bimopenflow/contracts types-only.
- dist/ not committed; the C# Publishing layer must run `npm run -w @bimopenflow/viz bundle` or the supervisor stages the artifact.
- jsdom setup dominates vitest wall-time (34s setup vs 136ms tests) — pool/shard later if more jsdom packages appear.

### Track PUBS (BimOpenFlow.Publishing / Dashboards / Reports / Evidence) — 42 tests
- Generated contracts file lacked `#nullable enable` (CS8669 on every build); supervisor fixed generate.mjs to emit it. The CS1737 optional-before-required record bug was fixed mid-wave; generate.mjs should keep emitting no defaults.
- TableJson/ValueJson encode NaN/±Infinity as strings, but viz charts treat string cells as non-numeric — NaN cells render null-ish in dashboards. Acceptable; worth a spec note.
- Test-fixture duplication: TestTable (Publishing.Tests) and run-record JSON builders (Dashboards/Reports/Evidence tests) are candidates for the shared TestKit.
- DashboardItem.OptionsJson stays raw JSON by design (viz option shapes evolve TS-side); revisit typed option records when options stabilize.
- EvidencePackage zip bytes are deterministic in practice (fixed entry timestamps, sorted entries) but Deflate output is runtime-version-dependent; only manifest/member sha256 hashes are contractually deterministic. Signing is a TODO.
- Live-session dashboard variant (SSE-driven) deferred with a TODO; static-from-run works end to end with the real 8.8KB viz bundle located via VizBundle.FindInRepo.

### Track APP (@bimopenflow/app) — 33 tests
- Gratify embed seam: syncing an external store into Runtime.dispatch must be deferred one microtask — a nested dispatch inside update is silently overwritten (worked around in canvasEditor.ts); gratify could expose a setDoc/external-sync API.
- Anchor meta is untyped (unknown) through gratify's Query — a generic meta parameter upstream would remove local casts.
- addNode from catalog costs three undo steps (add + setLayout + select); the state package could offer a compound/transaction action.
- The state reducer snapshots undo on every setLayout, so canvas drags commit only on release — copy the transient-move pattern in canvasIntents.ts.
- Canvas needs a light gratify theme to match the app chrome (platoflow's theme.ts is the model).
- Geometry asset scheme fixed by supervisor to model:{id} -> /api/models/{id}/bos, matching the host route; promote the endpoint to contracts.json when it stabilizes.
- vite build emits one 973 kB chunk (three) — code-splitting is a cosmetic TODO.
