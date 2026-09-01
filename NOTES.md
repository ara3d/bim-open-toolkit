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
- Shared-worktree incident: an --amend raced another track's commit and rewrote it; f66e52d carries ~2.5MB bin/obj blobs in history (HEAD clean, only that one commit affected). Rule reinforced: never amend on a shared worktree.
- Root cause of those blobs (fixed 2026-08-31): `.gitignore` patterns `*.bos`/`*.duckdb` match any path component by name, and ignore matching is case-insensitive on Windows, so the directories `src/BimOpenFlow.Nodes.Bos` and `src/Ara3D.BimOpenSchema.DuckDb` were excluded whole. Tracks could only stage their sources with `git add -f`, which bypasses every ignore rule and swept `bin/`+`obj/` in with them. Fixed by re-including all directories under `src/` and `tests/` (`!src/**/`, `!tests/**/`) and moving the build-output rules last so they still win — no `-f` is ever needed now. Lesson: a name-matching ignore pattern that can collide with a project directory is a latent artifact leak; never reach for `git add -f`, fix the ignore rule instead.
- The blobs were left in history deliberately: removing them needs a force-push of `main` on a public repo, which breaks existing clones and forks for ~2.5MB of a 8.3MB `.git`. Do it only as a deliberate, announced cleanup when no other session is working the repo.

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

### Track VEXT (@ara3d/viewer-loaders + @ara3d/viewer-controls) â€” 45 tests
- BOS reader ported, not stubbed: `.bos` = ZIP of parquet tables (not BFAST); vertices Int32 fixed-point /10000, mesh-local indices; decoded with jszip + hyparquet (pure JS). Sources recovered from @ara3d/ara3d-webgl 1.3.15's published source map.
- Core API gap: `Viewer.sceneObject` is private â€” picking/clipping can't reach the viewer's meshes; core needs a one-line accessor (`get objects(): SceneObject`).
- Core API gap: clipping needs `WebGLRenderer.localClippingEnabled = true` but the renderer is private too.
- three's GLTFLoader parses geometry-only GLBs headless under Node â€” cheap real-file integration tests without a browser.
- Per-instance alpha (instanceColor is RGB-only) and per-instance visibility (group-level only) limited by core; BOS hidden instances dropped (TODO in bos-geometry.ts); multi-material meshes use first material (TODO in three-convert.ts).
- `loadBos` returns `groupEntities` mapping instances back to BOS entity indices for future picking-to-data wiring.

### Track ENG (Ara3D.DataFlowEngine) â€” 53 tests
- Two spec/code conflicts pinned in favor of code: hash is plain lowercase hex (spec says "sha256:" prefix) and no Integer->Number widening at edges (spec mandates it; GraphValidation rejects such edges). Spec needs a 0.1.x errata pass.
- Memo key has no node id â€” identical work shares one cache entry across nodes (tested); only successful Pure evals cached; cache unbounded, eviction is future work.
- `PortSpec` lacks the spec's required/optional input flag; every input port pinned as required (missing edge -> Unready, not error). One place to touch when the flag lands: `Evaluator.EvaluateNode`.
- Warnings are memoized with outputs and replayed on hits â€” memo hits observationally identical to re-execution; worth stating in spec Â§4.
- Cancellation pinned as pass-abort: previous snapshot kept (atomic commit), memo entries kept, execution counts roll back.
- TestNodes fakes mirror the spec Â§8 conformance vocabulary â€” TestKit can lift them nearly verbatim.

### Track TK/CONF (Ara3D.DataFlowEngine.TestKit + Conformance) â€” 24 + 12 tests (3 ignored)
- All concrete conformance expectations matched the engine â€” no wrong vectors.
- Frozen TBD-by-engine hashes: format 001/006 graphHash `5ca17f12â€¦`, runs 001 record hashes; runs 002 graphHash left TBD (fixture has no document, value irrelevant â€” RUNS or SPEC should freeze a dummy).
- Engine has no Run implementation (effects only reach EffectPending); conformance ships a minimal StepHarness Run driver that should delegate to the real engine Run when one lands.
- Spec gives no default for `test.const`'s `kind` param, yet format vectors 001/006 omit it; TestKit defaults to Integer, which those vectors implicitly rely on.
- Engine test project's internal `test.const` (Integer-only) diverges from spec Â§8 (`kind`+`value`); could be replaced by TestKit.
- GraphBuilder is immutable; static+instance `Node` on one class is illegal in C#, hence the `Graph` static facade.

### Track RUNS (Ara3D.DataFlowEngine.Runs) â€” 24 tests
- `run.schema.json` has `additionalProperties: false` and no `warnings` member, yet the task lists warnings â€” `RunRecord.Warnings` is in-memory only, never serialized; TODO proposes a schema minor bump.
- Task's `Freeze` signature was unimplementable without the registry (port names and Effect capability live in NodeSpec) â€” added an `INodeRegistry` parameter.
- Schema has no slot for EffectInputs; `effects` lists only executed effects, EffectPending nodes excluded everywhere.
- Replay skips output comparison for EffectPending nodes (engine has no effect-free Run recompute yet; TODO at the skip).
- MemoryTable/MemoryColumn now exist in three fenced places â€” a public minimal in-memory IDataTable in the vendored Ara3D.DataTable would deduplicate (DataTableBuilder's null-cell behavior is undocumented).
- Freeze->serialize->parse round-trip is byte-identical; both spec conformance vectors executed with inline fakes.

### Track MIG (Ara3D.NodeGraph.Migrations) â€” 9 tests
- GraphDocumentIO.Parse treats `formatVersion` as optional and never checks it â€” the migrator is the only place version compatibility is enforced; direct Parse callers bypass checking entirely.
- No-op fast path returns already-current documents byte-identical without canonicalizing â€” the method is "migrate", not "normalize" (documented in README).
- `System.Version` comparison accepts four-part versions and rejects prerelease suffixes (`0.2.0-beta`); fine while the spec uses plain x.y.z.
- 0.1.0 is the first format, so the production registry is empty; the exemplar migration is a test-only fake.

### Track BOSP (BimOpenFlow.Nodes.Bos) â€” 23 tests
- `.gitignore` rule `*.bos` (line 17) ignores the whole `src/BimOpenFlow.Nodes.Bos/` directory â€” had to `git add -f`; scope the rule.
- SDK bug: `ParquetUtils.ReadBimDataFromParquetZip` NREs on any .bos without geometry tables (BimGeometryExtensions.cs:251) â€” every file written by `WriteToParquetZip` is unreadable by it; tests append an empty BimGeometry to work around.
- `bos.harmonize` standalone node skipped: `BosHarmonizer.Harmonize` transforms IBimData (not tables) and has no target-unit-system parameter; wrapped as bos.load's `harmonize` flag instead.
- bos.load adds ORDER BY to view queries â€” DuckDB gives no stable row order from the LEFT-JOIN views; determinism matters for memoization/hashing in any pack materializing views.
- `table.aggregate` CASTs `sum` to BIGINT/DOUBLE so results aren't HUGEINT/BigInteger.
- Stale `ParameterType` alias shift appears resolved (enum now contiguous); only pre-fix .bos files carry shifted codes.

### Track CMP (BimOpenFlow.Nodes.Compliance) â€” 30 tests
- `NodeSpec` cannot express optional or variadic inputs â€” `check.union` takes exactly two Tables (chain for more); `reviewExpr` optionality encoded as empty-string-means-unused. Consider optional-port support in Abstractions.
- Verdict-table convention: exact columns `verdict`/`checkId`/`checkTitle`/`citation` appended in order; output table name = checkId; severity Fail > NeedsReview > InfoNotAvailable > Pass.
- `Verdict` is a local mirror of the contracts.json enum; needs a member-for-member identity test once a project references both (host).
- No reusable in-code IDataTable builder existed in the repo â€” pack carries an internal ~70-line MemoryTable; promote if other packs need it.
- Expression column-type mapping defined here (bool->Boolean, integrals->Integer, float/double/decimal->Number, string->Text, Nullable unwrapped); other table-producing packs must emit those CLR descriptor types or columns won't be addressable from `check.rule` expressions.

### Track GEO (BimOpenFlow.Nodes.Geometry) â€” 19 tests
- `InstanceStruct.EntityIndex` actually holds the STEP express id, not an index â€” misleading; worth renaming upstream or documenting in Ara3D.Models.
- `Approach1Mesher.Build` with `includeGeometry: false` is pure C# â€” the native web-ifc dll never loads on this path; the windows/x64 constraint is inherited, not exercised.
- `DataTableBuilder.AddColumn(IDataColumn)` reuses live column objects; safe copying needs materializing via `Array.CreateInstance` â€” a shared "copy/select rows" helper may belong in Ara3D.DataTable.
- Canonical cell-text join rules duplicate `Scalar.ToCanonicalText` from Expressions; promote to a shared table-utils module if a third pack needs them.
- ModelGeometryCache is unbounded (TODO); host should own eviction. Instance table rebuilt per `view3d.instances` eval â€” cache it if eval frequency grows.
- Joins compare canonical invariant text, so Integer 2 joins Text "2"; categorical color indices stable under row reordering (sorted distinct text).

### Track EFF (BimOpenFlow.Nodes.Effects) â€” 10 tests
- `Ara3D.Ifc.Editing` compiles into namespace `Ara3D.Ifc.Tests` (RootNamespace in its csproj) â€” consumers must `using Ara3D.Ifc.Tests;`; worth renaming.
- Doc inconsistency: charter and docs/bimopenflow-structure.md list GLB/BOS export sinks (naming Ara3D.IO.GltfExporter), but the granted dependency set has no geometry/schema projects â€” deferred with README note + TODO.
- Third copy of minimal in-memory IDataTable now exists; CSV writer is a near-duplicate of BimOpenSchema.IO's WriteCsv (unreferenced because that project drags in Sqlite) â€” both TODO-flagged for hoisting.
- Tiny hand-written 14-line IFC4 file parses through `IfcSourceFile.Load` â€” pset write-back testable without duplex.ifc or native deps.
- STEP parser memory-maps files and can hold the lock past Dispose â€” temp-dir cleanup must be best-effort; expect this anywhere writing then reloading IFC in-process.
- Deterministic GUIDs from guidKey make repeated writePsets runs byte-identical (tested); all values written as IFCTEXT in v1 (typed measures deferred).

### Track CAT (BimOpenFlow.Host.Catalog) â€” 15 tests
- `IfcToBosConverter.Convert` static helper never disposes the IfcFile it opens â€” both platoflow and Host.Catalog carry their own dispose wrapper; fix at the source.
- Cache concurrency without lock files: write uniquely-named `.tmp` then `File.Move` â€” first rename wins, losers delete their temp.
- Content-hash cache keying means a renamed source reuses the cached conversion but changes the model Id â€” Host.Store should key run records by ContentHash for rename-stability.
- `Scan()` eagerly SHA-256-hashes every file; TODO to memoize by (path, size, mtime). Cache dir accumulates orphaned `{hash}.bos` files â€” eviction TODO.
- Entity/parameter counts read cheaply from `ReadBimDataFromParquetZip` â€” Host.Api can serve model metadata without a DuckDB step.

### Track STO (BimOpenFlow.Host.Store) â€” 20 tests
- Run timestamps in file names strip punctuation (colons illegal on Windows) but still sort chronologically.
- Save is a no-op returning false on byte-identical canonical JSON; otherwise old current archived to a version slot, new current via temp+atomic rename. Crash window between copy and replace can leave a duplicated archived version (harmless, documented).
- Concurrency is last-writer-wins v1; optimistic concurrency (compare graph hash) can layer on later without changing the on-disk layout.
- `History` recomputes each version's graph hash by loading the document â€” O(versions) reads; hash sidecar is the obvious later optimization.
- Missing-analysis Load surfaces raw `DirectoryNotFoundException`/`FileNotFoundException` â€” Host.Api must map to 404 itself.

### Track API (BimOpenFlow.Host.Api) â€” 17 tests
- BLOCKER found: generated `BimOpenFlow.Contracts.g.cs` didn't compile â€” `NodeState` emitted `string? Error = null` before required `Warnings` (CS1737); fix belongs in contracts/generate.mjs (regenerate; track left a one-line uncommitted worktree patch).
- ASP.NET Core minimal APIs, framework-only (no packages); tests run real Kestrel on `127.0.0.1:0` â€” no Mvc.Testing/TestServer needed.
- Contract `ModelSummary.sizeBytes` is `int` â€” models over 2 GB clamp; propose `long` in contracts.json (TODO in ApiMapping).
- `RunSummary` has no timestamp/hash source except the run file, so listRuns parses every record per request â€” candidate for filename-derived summaries.
- Sessions never watch the store directory; out-of-band edits to `current.dfg.json` leave a stale EvalSession until the next PUT (TODO).
- `catalog.Scan()` re-hashes every model per call; listModels and createRun both pay it â€” the Catalog memoization TODO will matter for polling clients.
- Wire casing verified against generated TS: camelCase, enums as exact name strings, nullable fields omitted when null.

### Track STATE (@bimopenflow/state) â€” 41 tests
- `ApiClient.analysisEvents` constructs `EventSource` directly with no injection point â€” `connectAnalysis` takes a structural `AnalysisApi` subset instead; consider generating such an interface alongside the class in contracts codegen. This also forces "DOM" into the tsconfig lib.
- `serializeDocument` is near-canonical but double formatting isn't guaranteed byte-identical to C# "R" round-trip â€” server must re-canonicalize on PUT.
- Reducer throws on invalid edits (mirroring NodeGraph exceptions), state unchanged on throw; UI layer needs try/catch or validation around dispatch.
- Undo/redo stacks are serialized-document snapshots kept in state so the reducer stays pure; selection excluded from history.
- `markSaved` is an extra internal action beyond the specified set â€” save() must clear dirty through the dispatch choke point.

### Track PANES (@bimopenflow/panes) â€” 66 tests
- `@bimopenflow/contracts` and viz resolve through existing workspace junctions; only cross-workspace `@ara3d/viewer-*` need tsconfig/vitest aliases until a real install links them (TODO-marked for the supervisor).
- Viewer controls' minimal element interfaces (`InputElement`, `PickElement`) aren't satisfied by `HTMLCanvasElement` under strict function types â€” panes casts through `unknown`; widen those signatures in viewer/packages/controls.
- viz doesn't export its column helpers, so panes reimplements a small `columns.ts`; promote into viz's public API if a third consumer appears.
- viz `DataTableView` re-renders on header-click sort with no hook â€” TablePane uses a MutationObserver to keep selection highlights; an `onRender`/row-metadata option in viz would remove that.
- Per-instance isolation in the 3D pane is alpha 0 (InstancedGroup visibility is group-level only); true per-instance hide needs viewer-core support.
- 3D picks emit entity ids via BOS `groupEntities`; GLB has no mapping so picks emit nothing.


### Track HOSTMCP (BimOpenFlow.Host + BimOpenFlow.Mcp) — 11 + 12 tests
- McpJson (Ara3D.MCP 1.6.2-local) lacks JsonStringEnumConverter; any tool returning contract records emits numeric enums — tools return anonymous objects with enum.ToString() instead. Worth adding the converter to the SDK package.
- ApiServer.MapBimOpenFlowApi news its own AnalysisSessions with no injection overload; a host+MCP single process would hold two session sets. Add an overload accepting sessions (Host.Api).
- Host and Mcp as separate processes each hold independent AnalysisSessions; cross-process staleness covered by the existing no-mtime-check TODO in AnalysisSessions.
- ModelSummary.SizeBytes int clamp in ApiMapping retired by supervisor after the long contract change landed.
- HostConfig --port is meaningless to bimopenflow-mcp (MCP HTTP port comes from --http [port]); doc line needed.
- GET /api/models/{id}/bos lives in Host (ModelBytesEndpoint) with a TODO to promote to contracts.json once a binary-endpoint shape exists; HostComposition.BuildServices returns catalog/store/registry with no ASP.NET types — the single wiring seam both Host and Mcp use.

### Table sandbox wave (2026-08-31)
- Optional input ports (spec §2) now implemented: unconnected optional → MissingValue placeholder, out of the memo key. sql.query t1..t4 is the first consumer; nodes must skip MissingValue when consuming optional positions.
- DuckDB DATE/TIMESTAMP columns break ValueHash ("column type DateOnly is not hashable") — tables on the wire carry only the five spec kinds, so the DuckDb pack normalizes date-like columns to ISO-8601 text (NormalizeDates, applied in all three nodes; xlsx.read already did this). If a real date column kind is ever wanted it is a spec change first.
- DuckDB.NET 1.3.2: connection-string config works for read-only opens (DataSource=...;ACCESS_MODE=READ_ONLY) — no helper-library change needed.
- Microsoft.Data.Sqlite pooling holds the db file open on Windows; tests/seeding must use Pooling=False or ClearAllPools() before deleting temp dirs.
- SQLite columns are per-row typed; sqlite.query unifies per column (one type wins, long+double → double, else canonical text). ClosedXML used-range may not start at A1; xlsx.read addresses via RangeAddress.
- HostConfig record growth wart: adding a required positional param broke 3 external constructor call sites; defaulted Profile instead. Prefer defaulted params when extending config records.
- Track C hand-computed expectation had a typo (P-13 revenue 3432.25 vs true 3431.25) — the pipeline was right; hand-check arithmetic twice or compute expectations in-test.
- Pack-local helper duplication (NodeArgs/TableOps copies in DuckDb and Tables packs) is now three-fold across packs; candidate for a small shared support project if a fourth pack appears.
- Docs generator observations: check.rule param 'title' emits column 'checkTitle'; Geometry/Compliance packs cast inputs raw (InvalidCastException instead of kind-named errors); duck.read has no 'options' param yet (proposal lists one); bos.query still exists alongside sql.query (retirement pending, proposal open question 7).

### Sandbox UI wave (2026-08-31)
- Canvas flash on panel resize, root cause: gratify's ResizeObserver sets canvas.width/height (clearing the bitmap) and only schedules the repaint for the NEXT rAF — one blank frame per resize event. App-side fix is ghost-line splitters (apply width once on pointerup). If live-resize is ever wanted, gratify core needs a synchronous redraw in its resize path.
- Catalog-click "GET 404": paneArea fetched results for a just-added, never-evaluated node; gated by hasResults(status==Ok). A "run to see results" hint would be a panes-package change.
- Sidebar has no rename field for analyses — untitled-N names are permanent until a rename UI exists. Needs an owner.
- gratify supports live theme swap (setTheme retargets tokens + cross-fades ~0.5s; themeVersion invalidates style caches). Canvas themes register as "bof-*" palettes; per-part non-token colors route through canvasColors() in canvasTheme.ts — add new part colors there, never as raw rgb() in canvasParts. Theme extras snap while tokens fade (cosmetic).
- gratify theme state is module-global (one theme per page); two canvases with different themes would need a gratify-core change.
- platoflow's cream theme mapped one-to-one onto gratify tokens; wire color on light = platoflow's "hue whisper" gray #7A98A8.
- Sample seeding: only into an EMPTY store, only in tables profile, {SAMPLES} placeholder rewritten at seed time; walks up to BimOpenToolkit.sln and skips silently when not found (installed deployments).
- A running dotnet host locks its bin dir — stop it before `dotnet build` at integration (MSB3027).

### Data-node-sets wave (2026-09-01) — supervisor + 6 tracks + web track

## Contract changes (this wave)
- ParamKind gains DateTime (contracts.json + engine enum + spec format.md §4: ISO-8601 canonical, empty = unset). First users: table.calendar, date.filter.
- New packs BimOpenFlow.Nodes.TableOps/Cleaning/Dates; tables profile now also serves EffectNodes.TableSinks (the six table writers) — writePsets/report stay BIM-profile-only.
- Shared generated-SQL backbone DuckTableSql (Run/QuoteIdent/QuoteLiteral/NormalizeDatesToText) added to Ara3D.BimOpenSchema.DuckDb, below the packs.

## Findings
- Deviations from the proposal, deliberate: xlsx.read/table.join/sink.exportCsv extended IN PLACE at v1 (behavior-preserving defaults) instead of v2 — saved graphs pin (kind, version) and nothing migrates them yet. table.range/calendar are plain C# (Tables pack stays DuckDB-free) with generate_series semantics preserved.
- Determinism: every ordered SQL transform injects a collision-free ordinal column and ORDER BYs it; DISTINCT ON and first() are avoided (arg_min/row_number instead). DuckDB sum() widens BIGINT to HUGEINT — must CAST back or the wire kinds cannot carry it.
- DuckDB warts: split_part returns "" not NULL out of range; regexp_extract returns "" on no match; SUMMARIZE min/max/avg come back VARCHAR in 1.3; glob() returns forward-slash paths on Windows; try_strptime exists in 1.3.
- sqlite/duckdb writers edit the target in place inside one transaction (temp-file replace would destroy other tables in the database); file writers are temp-then-move atomic.
- git pathspec commits do NOT pick up untracked files (Track TABLES slip: two commits landed without their new files; tip fixed by a follow-up commit). Waves should require `git add <paths>` before `git commit -- <paths>`.
- Hoisting candidates repeated by 3+ packs: ordinal/WithOrdinal machinery, RequireColumn, CLR-type-to-wire-name mapping — the `Ara3D.DuckDb` graduation (core proposal open question 2) would house them. DONE (2026-09-01): BimOpenFlow.Nodes.Support (refs Abstractions only, so the DuckDB-free Tables pack can use it) now holds NodeArgs, TableColumns, and FileHashes; DuckTableSql gained kind-prefixed Run overloads and Ident/Literal sugar; NodeTestHelpers/FakeEvalContext moved to Ara3D.DataFlowEngine.TestKit. Pack-specific behavior stayed local: Dates keeps case-sensitive column checks, Cleaning its text-column helpers, Effects its whitespace-accepting RequiredText, Host.Catalog its lowercase HashFile (pairs with Runs.Hashes; different layer).
- Web inline controls: gratify islands carry DOM inputs through pan/zoom (island facet); Boolean/Enum are canvas-drawn (undo-clean local state + modal dropdown); commits happen on change/gesture-up only, because the store snapshots the whole doc per edit for undo. setLayout now merges partial layouts (drag used to drop stored w/h). Sidebar groups the 67-kind catalog by dotted prefix.
- The UX proposal (bimopenflow-ux-proposal.md) had routed scalar editing to the params pane; inline node controls are a deliberate change of course per user direction — the pane remains for Json/Expression/ModelRef and as the full editor.

### Chart nodes wave (2026-09-01) — supervisor + 2 tracks

- D3 considered and rejected on purpose: @bimopenflow/viz stays zero-dependency (8.8KB IIFE, inlinable into dashboards) so dashboards and the live app share one renderer; grouped bars and titles were added to viz instead. Pie/scatter deferred — "a chart family deserves one coherent design pass" (platoflow-v1-nodes).
- Concurrent-session collisions, twice: (1) baseline gate ran red because another live session had HostComposition.cs/sln mid-flight (BimAnalysis pack) — registration was deferred to integration and full-solution gates replaced by scoped per-project gates; (2) another session edited paneArea.ts/paneChoice.ts (inside Track WEB's fence) mid-wave adding a view3d "boxes" path — WEB's commits survived, merged state re-verified. Fence tables in CONTRACTS.md only bind THIS session's tracks; live peer sessions don't read them mid-flight. Consider a repo-level convention (e.g. a CLAIMS.md or lock notes) for cross-session fencing.
- Track PACK: Support/TestKit has no generic table-projection or row-reorder helper — TableProjectNode (Nodes.Tables), VizProjection.Project (Nodes.Viz), and TableColumns.WithOrdinal now triplicate the copy-columns loop; a Support-level Project(table, indices, rowOrder) would collapse all three. Numeric-vs-text column classification via KindName strings ("Integer"/"Number") is stringly-typed; a Support enum would be safer.
- Track WEB: unknown seriesColumns names in viz charts changed from throw to skip-with-fallback — node params pass through raw and the server only warns, so the client must tolerate them. BarChart default changed from first-numeric-column to all-numeric-except-category (contract): any multi-numeric table now renders grouped bars by default, visible on non-chart nodes' chart tab. Title styling is inline attrs because styles.ts was frozen this wave; a .bof-viz-title rule there is a one-line follow-up. chartPaneOptions(kind, values) lives in app/paneChoice.ts as a pure function — testable without the panes/viewer import chain.
- dotnet run --project X --nologo passes --nologo to the PROGRAM (argv[0]) — NodeDocs happily wrote its output to a file named "--nologo". Use `dotnet run --project X -- <args>` or no trailing options.
- Fresh-context review earned its cost: caught two seam defects the tracks' own tests missed — chart pane options frozen at creation (param edits stale/throwing while the chart tab is open; fixed by re-activating on option change) and warn-on-server/throw-on-client asymmetry (BarChart threw on unknown category / empty series where C# only warns; fixed by lenient fallbacks + case-insensitive column lookup in viz columns.ts, matching C# TableColumns). Rule of thumb pinned: the client renderer must be at least as lenient as the server validator for any param that flows through raw.
- view.table vs table.project overlap and the 3x table-copy loop are TODO-marked in Nodes.Viz (VizProjection/ViewTableNode) — Support-level Project(table, indices, rowOrder) is the collapse point.

### BimAnalysis pack wave (2026-09-01) — supervisor + 5 tracks (SRC/GEO/PAR/CLS/NAV)

- 12 bim.* nodes, 78 pack tests + 18 workflow tests, all first-run green after the contract commit; zero fence violations and zero contract-change requests. Freezing full NodeSpecs plus exact sample-model expected values in the track prompts is what made every track land green without iteration.
- ParameterText renders Point params as a bare index (CAST(p.Value AS VARCHAR)), and EntityModel.ParameterValues stringifies them — points/bounds are only reachable from raw IBimData. BimModel (pack-level) indexes (entity, paramName) → Point for this; consider a resolved-points view in BosDuckDbViews later.
- The engine does not inject ParamSpec defaults into ParamValues — every node re-implements `GetText(name, default)` with a blank-falls-back guard (three tracks independently flagged it). An engine-level default injection (or a Support helper) would remove the pattern.
- EntityModel.GetParameterAsNumber/AsInt throw InvalidCastException on absent params; the pack guards via TryGetValue+is float everywhere. A safe TryGetParameterAsNumber on EntityModel is a cheap SDK fix.
- Room names are not unique across levels (two "Corridor"s); bim.navGraph labels rooms "Name Number" so hop analysis doesn't merge floors. Float round-trip is user-visible: door D4 center Y = 8.0000002, so hand-written boxes against bim.bounds centers need tolerance (bim.rooms boxes from the same floats are consistent).
- Duplication debt (TODO-marked in code): ParamOr/Numeric/CopyColumns in BimContainmentNode+BimNearestNode, AppendTextColumn in both classification nodes — same collapse point as the Viz wave's finding: a Support-level table copy/append/project helper. BimColumns lacks Value/Units constants (paramCoverage uses one literal).
- Cross-session collisions again (same day as chart wave): a peer session extended BimSampleSeeding for view3d samples mid-wave and added Viz to TablePacks without updating ExpectedTableKinds (fixed here). Full-solution test runs are flaky while two sessions run suites concurrently (file locks, shared data/); scoped per-project gates + isolated re-runs were the workaround.
