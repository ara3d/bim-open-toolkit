# What to do next with the IFC mesher

A report for the owner, written 2026-10-11 after the layout work (TKT-216) and the five-mesher comparison (TKT-225). It says where `Ara3D.Ifc.Mesher` stands, what would make it efficient to develop and modular to maintain, and proposes an ordered set of tracks with chunks, fences, and measures. Nothing here is started; each track becomes tickets when the owner picks it. The brief's workflows served: 3 (a picture of the model is only as good as its mesh) and 5 (a claim needs another tool's number beside it).

## Where it stands

**Code.** One net8.0 project, 43 files, 6,365 lines, largest file 347 lines, no native code. It depends on `Ara3D.Ifc.Entities` (STEP entities and the resolver) and five Ara3D SDK packages. Consumers: the IFC MCP server (`IfcSession`, `IfcGeometryTools`, `IfcGeometry`) and the toolkit's Geometry node pack. Entry point: the static `IfcMesher.Build` over an entity resolver, a STEP document, or a file.

**Coverage.** The coverage table (`GeometryCoverage.cs`) lists 72 geometry entity types: 16 Supported, 52 Partial, 4 Planned (`IFCADVANCEDBREPWITHVOIDS`, `IFCBOUNDINGBOX`, `IFCSECTIONEDSPINE`, and the catch-all). "Partial" covers everything from "fillet radii ignored" on steel profiles to "control-polygon approximation; knots ignored" on B-spline curves, which is a correctness gap, not a cosmetic one. `IFCBOOLEANRESULT` is handled only when the second operand is a half-space; general booleans are not.

**Tests.** 143 snippet-built tests in `Ara3D.Ifc.Mesher.Tests` (2 seconds, no model files); 94 tests in `Ara3D.IfcMeshingComparison` over model files and against web-ifc, each ignoring itself without its model; a committed parity scorecard and a five-mesher matrix under `bench/ifc-mesher/`. One pre-existing failure: one of 116 products on `example.ifc` has bounds more than 5 % off web-ifc's.

**Measured position** (`bench/ifc-mesher/RESULTS.md`, quick files only):

| Against | Parity |
|---|---:|
| Both web-ifc builds | 0.918 to 0.963 |
| IFClite and IfcOpenShell | 0.882 to 0.950 |
| The two families against each other | 0.88 to 0.95 |

So the mesher is inside the spread of the field on three small files. Three count differences are recorded and unexplained (extra instances from IFClite and IfcOpenShell, a 3.5× triangle range on `steelplates.ifc`, one `example.ifc` instance web-ifc 0.0.78 drops). Nothing is measured on a large model yet: no timing beyond the quick files, and the DigitalHub triangle count (TKT-190) is the only big-model number, from October.

**Time.** On IfcOpenHouse the mesher took 371 ms where the web-ifc DLL took 13 ms and IFClite 23 ms. The first call includes JIT warm-up, so this is not yet a measurement, but it is the first hint that performance has never been looked at.

**Open tickets.** TKT-65 (explain the quick-file gaps), TKT-188 (roof-clipped walls on AC20-FZK-Haus; the MCP tools measure one geometry while the GLB draws another), TKT-189 (an element whose geometry is shared gets no instance), TKT-190 (DigitalHub triangle count 1.45× web-ifc's, cause unmeasured), TKT-223 (test-support library, remaining large files), TKT-224 (owner paths elsewhere).

## What "efficient and modular" should mean here

Three things slow the mesher's development today, and each has a direct fix.

1. **Diagnosis is by hand.** A parity score says two meshers differ; finding which product and why means writing a one-off test, as the `Wp*` files of July did. The five-mesher matrix changes the economics: where four meshers agree and ours differs, that product is a defect with a reference answer attached. A per-product discrepancy table turns every low score into a worklist.
2. **The geometry kernel and the IFC mapping are one project.** Half the files have no IFC words in them: polygon triangulation, half-space clipping, convex carving, surface parametrisation, mesh deduplication, sweep rings. They are tested only through IFC snippets, they cannot be reused by the viewer or the BOS geometry code, and a change to the kernel and a change to the mapping land in the same build unit. `LIBRARIES.md`'s test ("try writing its README without naming the application") says they are a library.
3. **The evidence loop is manual.** The scorecard, the matrix, and the gates exist, but nothing fails when a number drops, and nothing records the large-model numbers over time. A ratchet (a committed floor that a run may raise and a test may not lower) makes every improvement permanent and every regression loud.

## The shape to aim for

```
Ara3D.Ifc.Entities            STEP entities and the resolver (exists)
Ara3D.MeshKernel              NEW: polygons, triangulation, clipping, carving, surface maps, dedup, sweeps; no IFC words
Ara3D.Ifc.Mesher              IFC entity -> kernel calls: placements, units, curves, profiles, solids, breps, assembly
Ara3D.Ifc.Mesher.TestSupport  NEW (TKT-223): MicroIfc, MeshTestAssert, geometry oracles, MatrixNorms, MeshDump
Ara3D.Ifc.Mesher.Tests        snippet tests, 2 s
Ara3D.IfcMeshingComparison    model files, web-ifc oracle, five-mesher matrix, discrepancy tables
bench/ifc-mesher              committed dumps, scorecard, matrix, ratchets, RESULTS.md
```

Inside `Ara3D.Ifc.Mesher`, the pipeline already has three seams worth making explicit as types, so each stage can be tested and replaced alone:

- **entity → item mesh**: `GeometryDispatcher.TryBuild(ctx, entity) : TriangleMesh3D?` (exists). Its callers should be the only place that knows an entity name.
- **representation → parts**: `GeometryPartCollector.CollectParts(...)` and `ModelAssembler.CollectScopedParts(...)` are two copies of the same walk, one with a dedup scope. One walk returning `CollectedPart` with the scope as a field retires the copy.
- **parts → Model3D**: `ModelAssembler.BuildModel` plus `MeshDedup` and `AggregatedVoidHosts`. This is where opening carving happens; it should take parts and void relations in and return a model, with no entity lookups of its own, so it can run over a dump from another mesher too.

The kernel's public surface is small and already functional: `PolygonWithHoles.Triangulate`, `Booleans.ClipByHalfSpace`, `OpeningCarver.CarveConvex`, `SurfaceMap.Resolve`, `MeshDedup.GetOrAddMesh`, `SweepRings.Connect`. Its README can be written without the word IFC.

## Tracks

Each track is a plan file of its own when started (`docs/plans/`), with chunks that pass the existing tests unchanged, one commit per chunk, fences that do not overlap, a fresh review, and a fix pass. Numbers in "Done" are what a run must show; where no number exists yet, the first chunk measures one.

### Track A: a discrepancy table from the five meshers (TKT-65, TKT-190, the three unexplained counts)

The tool that makes every other track cheaper. For a file and a set of meshers, list per product: which meshers produced it, triangle counts, bounds, volume, and the shape score against the majority. Sort by how far ours is from the majority. The majority is not truth, but a product where four tools agree and ours does not is where to look first, and a product where all five disagree is one to leave alone.

| Chunk | Commit | Fence | Done |
|---|---|---|---|
| A1 | `ProductDiscrepancy` record and `DiscrepancyTable.Build(file, backends)` in the harness, with a Markdown writer | `Harness/DiscrepancyTable.cs`, a test file | runs on the quick files from the committed dumps in under 10 s |
| A2 | The table for the quick files committed to `bench/ifc-mesher/discrepancies/`; TKT-65's "one product", "4 of 14", and "28 of 116" named from it | `bench/ifc-mesher/discrepancies/**`, `RESULTS.md` | each TKT-65 criterion has an express id beside it |
| A3 | Dumps and tables for Duplex, DigitalHub, Schependomlaan under `artifacts/`, a timing row per mesher per file in `meshers.json` | `bench/ifc-mesher/meshers/run.mjs`, `meshers.json` | five timings per large file; TKT-190's 1.45× has a per-product breakdown |
| A4 | One ticket per cause found, each with the express id, the file, and the majority answer; TKT-65 closed into them | `tickets/**` | no ticket rests on a theory |

Done: every low parity on the quick files maps to named products with a cause, and the large-model numbers exist.

### Track B: extract the mesh kernel (`Ara3D.MeshKernel`)

A refactor with no behaviour change, so every chunk passes the 237 existing tests unchanged. Order the moves so each leaves the build green.

| Chunk | Commit | Fence | Done |
|---|---|---|---|
| B1 | New net8.0 project with `PolygonWithHoles`, `Tolerance`, and the Earcut triangulation; the mesher references it | `src/data/Ara3D.MeshKernel/**`, mesher csproj | mesher tests pass; kernel has its own three tests (a square, a square with a hole, a bow tie) |
| B2 | `Booleans` (half-space clip) and `OpeningCarver.CarveConvex` move; the IFC-reading parts of `Booleans` stay behind as `BooleanItems` | kernel, `Booleans.cs`, `OpeningCarver.cs` | the IFC-free half has tests on hand-built boxes |
| B3 | `SurfaceMap` family, `SweepRings`, `MeshDedup`, the geometry half of `MeshHelpers` move; `MeshHelpers` keeps only entity readers | kernel, those files | kernel README written without the word IFC |
| B4 | `Ara3D.Ifc.Mesher.TestSupport` (TKT-223): `MicroIfc`, asserts, oracles, `MeshDump` move out of the test project; the comparison project drops its reference to a test project | `tests/data/**` | both test projects build against it |
| B5 | Kernel invariants as tests: watertight after clip, winding preserved under mirror, dedup is exact | kernel tests | the oracles that live in `GeometryOracles/` run against kernel calls, not IFC snippets |

Done: `Ara3D.MeshKernel` builds and tests alone, `Ara3D.Ifc.Mesher` is the IFC mapping only, and the viewer or BOS geometry code could take the kernel without the mesher. Whether the kernel then moves to the Ara3D SDK is a later decision (see Open questions).

### Track C: coverage, driven by evidence

Not "implement every Partial", but the Partials that Track A shows cost parity on real files. Candidates known today, each its own plan when picked:

- **B-spline curves with knots** (`IFCBSPLINECURVEWITHKNOTS`, `IFCRATIONALBSPLINECURVEWITHKNOTS`): the control polygon stands in for the curve. A de Boor evaluator is about 60 lines, testable against a known circle expressed as a NURBS. DigitalHub has 20,904 trimmed curves and 1,314 advanced breps; this is the first suspect for TKT-190.
- **General `IFCBOOLEANRESULT`** (1,616 in the corpus inventory, 1,246 in one office model): today only the half-space case. A mesh-mesh boolean is the largest single piece of kernel work; the discrepancy table says whether it is worth it before anyone writes it.
- **Roof-clipped walls** (TKT-188): measured per element against the BOS geometry; 14 of 14 large disagreements on the AC20 models. The fix is in `AggregatedVoidHosts` or the clipping of upper walls by roofs; A2 will say which.
- **Shared geometry gets no instance** (TKT-189): an assembly question, in `ModelAssembler`.
- `IFCADVANCEDBREPWITHVOIDS`, `IFCSECTIONEDSPINE`: Planned; take them when a corpus file needs them.

Done per item: the entity moves from Partial to Supported in the coverage table, a `[GeometryCoverage]` test exists for it, and the scorecard or matrix shows the gain with the ratchet raised.

### Track D: performance, measured first

| Chunk | Commit | Fence | Done |
|---|---|---|---|
| D1 | A BenchmarkDotNet project (`bench/ifc-mesher/Ara3D.Ifc.Mesher.Benchmarks`) over the quick files and Duplex, with warm-up, writing a table beside `meshers.json` | new project | a number per file, warm, with the web-ifc DLL beside it |
| D2 | Profile the top three costs; fix only what the profile names (likely candidates: `MeshDedup` fingerprinting, `PolygonWithHoles.CleanRing`, LINQ in sweep loops) | files the profile names | the table moves; the house style's "no LINQ in hot paths" rule applied where the profile points |
| D3 | Products meshed in parallel: `BuildModel`'s loop over products is pure per product except the dedup and the diagnostics, which become a merge step | `ModelAssembler.cs`, `MeshDedup.cs`, `Diagnostics.cs` | same mesh and instance counts, deterministic order, time divided by cores on Duplex |

Done: a warm number per file in the bench, and a ratchet on it.

### Track E: ratchets and the evidence loop

| Chunk | Commit | Fence | Done |
|---|---|---|---|
| E1 | `bench/ifc-mesher/ratchets.json`: parity floor per quick file, coverage count, warm time ceiling; `ParityGates` reads the floors instead of hard-coding 0.85 | `ParityGates.cs`, `ratchets.json` | a drop below a floor fails the gate; a run that beats a floor may raise it in the same commit |
| E2 | `run.mjs --check`: fails when a committed dump is stale against its tool's version, so a tool update is a visible commit | `run.mjs` | CI can call it without the tools installed (it reads headers only) |
| E3 | The scorecard's timestamp moves out of `scorecard.json` into `RESULTS.md`, so a rerun with no change is a clean tree | `ModelComparer.WriteScorecard`, `scorecard.json` | `git status` clean after a no-change rerun |

## Order and parallelism

A first: it costs two or three chunks and every other track reads from it. B can run beside A, because B's fence is `src/data/**` and `tests/data/**` while A's is the harness and the bench; the one shared file is `TestFiles.cs`, which neither needs to edit. C waits for A2. D1 can start any time; D2 and D3 wait for D1's numbers. E1 and E3 are small jobs that fit between chunks.

With two agents: one on A, one on B, each in its own fence, both committing by path to the same checkout, as `GIT.md` describes. With one agent: A1, A2, B1 to B3, A3, then C by evidence.

## Platonic practices, applied

- **Correct first, measured.** Every track's Done line is a number a run prints, and the ratchets (E1) make a number a floor. No track asks for "better" without saying how it is read.
- **Easy to refactor.** Track B gives the kernel a build-enforced boundary and its own tests, so a kernel change cannot break the mapping silently, and a mapping change cannot reach into the kernel.
- **Built for parallel agents.** Fences are listed per chunk; the two long tracks share no file. Files stay under 350 lines, and the extraction keeps them there.
- **Don't repeat yourself.** The two representation walks (`GeometryPartCollector` and `CollectScopedParts`) become one; `SampleCircle` exists in two files after the split and goes to the kernel once; the two three-valued "how well is this handled" enums become one (TKT-223).
- **Plans and chunks.** Each track is a plan file with acceptance criteria, considered-and-rejected entries, chunks that pass existing tests unchanged, and a build log; each chunk is one commit with the ticket trailer.
- **Review and fix.** Each track ends with a fresh-context review and one commit per finding, as TKT-216 did (thirteen defects found, all fixed, two tickets filed).
- **Debt goes to tickets.** Nothing in this report is a promise; the tracks become tickets when picked, and what a track leaves undone is filed, not remembered.
- **No theories as facts.** Track A exists so that causes come from the files. The July notes were deleted for stating theories as findings; the discrepancy table is the tool that keeps that from recurring.

## Considered and rejected

- **Option:** replace the mesher's kernel with IFClite's (its Rust geometry through FFI or the Python wheel) or IfcOpenShell's. **Reason:** both are faster and agree with each other at 0.96 to 0.997, but either brings a native dependency back, which the portability criterion of TKT-216 just removed, and the toolkit's distinct claim is a pure C# path. **Would change if:** Track A shows the C# mesher wrong on a class of geometry (general booleans, say) that would take months to match, and the owner accepts a native optional backend for that class only.
- **Option:** implement every Partial in the coverage table. **Reason:** 52 entries, no measurement of which cost parity; Track A supplies the ordering for a tenth of the effort. **Would change if:** a customer file class is known in advance.
- **Option:** keep the kernel inside `Ara3D.Ifc.Mesher` and split only by file. **Reason:** files are already small; the problem is that the kernel cannot be tested or reused without IFC, which only a build unit fixes (`LIBRARIES.md`). **Would change if:** the kernel turned out to need IFC-specific tolerances or units in its signatures, which would show the boundary is wrong.
- **Option:** performance first, since 371 ms against 13 ms looks bad. **Reason:** that number includes JIT warm-up on a 1,175-triangle file; D1 measures before anyone optimises. **Would change if:** D1 shows the mesher more than ten times slower than the DLL warm on Duplex.

## Open questions for the owner

1. Does the extracted kernel belong in bim-open-data or in the Ara3D SDK (`ara3d-sdk`), beside `Ara3D.Geometry`? The SDK is the natural home for IFC-free geometry; bim-open-data is where it can be built and tested today without a package round-trip. The report proposes bim-open-data first and a move later (`LIBRARIES.md`: move to its own repository only when a second repository needs it).
2. Which model class matters most: the public samples the bench uses, or a Snowdon-size model (about 450,000 instances) where time and memory decide? Track D's D1 should include whichever the answer is.
3. Is a native optional backend ever acceptable for one geometry class (general booleans), or is pure C# a hard line?
