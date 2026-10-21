# perf-editing-repair: editing and repair layers without a whole-model scan per element or per defect

Ticket: TKT-397
Status: merged: L8 (2026-10-21, into 10-editing/editing-masks.{library,laws}.plato, editing-script.library.plato, 11-repair/repair-indexed.{types,library,laws}.plato; the edge scans kept as FacesAtVertexScanned and FacesOnCurveScanned, the agreement laws read them; ApplyScriptComposingRenumberings deleted and its agreement law dropped)

## Files

- `editing-masks.library.plato` (library `BrepEditingMasks`, layer 10): `RowMarks`, `MarkedRows`, `IsMarkedValue`,
  `OutsideRows`; `VertexSetByMask`, `EdgeSetByMask`, `FaceSetByMask`; `FacesCitingCounted(m, edgeMarks, vertexMarks, outside)`
  (one pass over every face's coedges and vertex loops); `EdgesAtMarkedVertices`; `ClosureOfVerticesOnce`;
  `HoldsSorted` (binary search, generic over `IIndex`), `CoversSorted(inv, f)`, `CoversSorted(inv, e)`; `DirtyAfterOnce`.
- `editing-script.library.plato` (library `BrepEditingScripts`, layer 10): `KeepsRowNumbers`, `RenumbersOnlyFaces`
  (and their topological forms), `ComposeFaces`, `ComposedAfter`, `ApplyScriptComposingRenumberings`.
- `repair-indexed.types.plato` (layer 11): `FaceRows` (faces in compressed rows by an integer key), `RepairIndex`.
- `repair-indexed.library.plato` (library `BrepRepairIndexed`, layer 11): `FacesAtVertexByCoedgesCounted`,
  `FacesAtVertexByCoedges`, `FacesOnCurveByCoedges`; `FaceRowsOf`, `DistinctFacesIn`; `RepairIndexCounted`,
  `RepairIndexOf`, `RepairIndexPasses`, `IsClosedShellIndexed`, `CountsAsEdgeGiven`, `IsInClosedShellIn`,
  `UseCountIndexed`; `Faces*Indexed` and `FacesTouchedByIndexedCounted`; `CostOfFaces`, `CostOfBound`, `CostOfIndexed`;
  `FixedByIndexedCounted`, `FreeEdgeChoiceIndexed`, `DiagnoseIndexedCounted`, `DiagnoseIndexed`,
  `PlanOfIndexedCounted`, `PlanOfIndexed`.
- `editing-perf.laws.plato` (library `BrepEditingPerfLaws`), `repair-perf.laws.plato` (library `BrepRepairPerfLaws`):
  agreement laws, the rewritten editing laws, the count witness `Witness_FacesAtVertexByCoedgesWork`.

## Done

- L8, (this commit), about 1.2 h against 2 h expected. Types added: `FaceRows` (E1's `EdgeFaceTable` has the same
  shape but its name and accessor are keyed by edge; a vertex, curve, surface or loop row needs its own), `RepairIndex`
  (what a plan's diagnoses read, built once per plan). Results identical everywhere; no floating-point change.
  - Warm interpreter (`plato_laws.py`, cpu64, budget 20): `BrepEditingPerfLaws,BrepRepairPerfLaws` 17 laws, 17 pass,
    first run; then `Law_Perf_ComparisonsSeeDifferences,Law_WorkIsWithinSlope,BrepRepairLaws,BrepEditingLaws` 31 laws,
    31 pass (every `BrepEditingLaws` and `BrepRepairLaws` law keeps its verdict, `Law_ScriptInverseUndoes` included).
  - Compiled (pinned CLI e37c032f, csharp, cpu64, `--budget=2`), filter
    `BrepEditingPerfLaws,BrepRepairPerfLaws,BrepRepairLaws,BrepEditingLaws,Law_WorkIsWithinSlope`: 50 laws, 48 pass,
    2 errors, both over-budget timeouts of laws this chunk does not own until merge:
    `BrepEditingLaws.Law_ScriptInverseUndoes` 4.47 s (3.59 s at baseline, before any staged file; pass in the verdicts
    file, which has no budget) and `Law_WorkIsWithinSlope` 2.08 s over 40 witnesses of every chunk (1.62 s in the
    next run). Every other library law passes, as in the verdicts file.
  - Compiled, filter `BrepEditingPerfLaws,BrepRepairPerfLaws,Law_WorkIsWithinSlope`: 21 laws, 21 pass; slowest
    `Law_Perf_ApplyScriptComposingRenumberingsAgrees` 1.40 s, `Law_Perf_ScriptInverseUndoes` 1.37 s,
    `..OnCylinder` 1.22 s, `..FromFive` 1.08 s, `Law_Perf_DirtyAfterOnceAgrees` 0.98 s, the rest under 0.8 s.
    Times under the 22-thread runner vary by about half between runs on this machine (the box half of the script law
    measured 1.37 s to 1.96 s).
  - The rewritten laws against the library's, same run: `Law_RemapIsIdentityForGeometricEdits` 1.32 to 1.80 s ->
    0.39 s; `Law_ComposeWithIdentityIsIdentity` 1.45 to 1.71 s -> 0.24 s; `Law_ScriptInverseUndoes` 3.6 to 4.7 s ->
    three laws of 1.1 to 1.4 s (split by witness, and the box by the first edit's index, -1 to 4 and 5 to 9).
  - Agreement laws: `Law_Perf_SetsByMaskAgree`, `Law_Perf_ClosureOfVerticesOnceAgrees` (selector vertices with repeats
    and -1, one vertex, every vertex), `Law_Perf_CoversSortedAgrees`, `Law_Perf_InvalidationSetsAreSorted` (what the
    binary search needs, on single edits and on DirtyAfterOnce), `Law_Perf_DirtyAfterOnceAgrees`,
    `Law_Perf_ApplyScriptComposingRenumberingsAgrees` (refused step, model, all ten remap tables, and the inverse
    scripts) on the unit box, the cylinder, the repair sample model and the sphere (vertex loops);
    `Law_Perf_FacesAtVertexByCoedgesAgrees`, `Law_Perf_FacesOnCurveByCoedgesAgrees`, `Law_Perf_RepairIndexAgrees`
    (every index of every table and -1 and two past the end), `Law_Perf_DiagnoseIndexedAgrees` (Diagnose, CostOf,
    CostOfBound, CostOfIndexed on the 28 sample defects and 16 extra ones at negative and past-the-end indices),
    `Law_Perf_PlanOfIndexedAgrees`; `Law_Perf_ComparisonsSeeDifferences` shows the comparisons tell different
    diagnoses, plans and face lists apart.
  - Count witness `Witness_FacesAtVertexByCoedgesWork`: Insertions are faces and coedges visited, slope
    `Insertions(2)`, sizes = coedge counts 6 (cylinder) and 24 (unit box), measured 9 and 30. FacesAtVertex tests
    every edge for every face and scans a face's coedges per edge at the vertex: about 6 x (12 + 12) = 144 on the box.
  - Exact count law `Law_Perf_PlanOfIndexedScansOnlyToBuildIndex`: `PlanOfIndexedCounted` on the repair sample model
    with 1, 8 and 28 planted defects makes exactly `Flips(7)`, the index's passes, and no scan per defect;
    `Law_Perf_FallbackScansAreCounted`: three defects at negative indices add exactly `Flips(3)`. PlanOf makes one or
    more whole-model scans per defect (IsInClosedShell per seam defect re-checks every shell; FreeEdge's UseCount per
    shell; FacesAtVertex, FacesOnCurve, FacesOnSurface, FacesOfLoop per action).

## Merge instructions

Layer 10 (move `editing-masks.library.plato` and `editing-script.library.plato` into `10-editing/`, or their bodies
into the files named):
- `VertexSet(m, xs)` (editing-closure.library.plato:23) => `m.VertexSetByMask(xs)`
- `EdgeSet(m, xs)` (:28) => `m.EdgeSetByMask(xs)`
- `FaceSet(m, xs)` (:33) => `m.FaceSetByMask(xs)`
- `ClosureOfVertices(m, vs)` (:113) => `m.ClosureOfVerticesOnce(vs)`
- `Covers(inv, f)` (editing-invalidation.library.plato:34) => `inv.CoversSorted(f)`; `Covers(inv, e)` (:38) => `inv.CoversSorted(e)`
- `DirtyAfter(t)` (:88) => `DirtyAfterOnce(t)`
- `Apply(m, script)` (editing-outcome.library.plato:329): replace `remap = remap.Compose(model.ResultRemap(o));` with
  `remap = remap.ComposedAfter(script.Edits[step], model.ResultRemap(o));`, then delete
  `ApplyScriptComposingRenumberings` and read it as `Apply` in `editing-perf.laws.plato`.
- `Law_ScriptInverseUndoes` (editing.laws.plato:309): replace by the three laws `Law_Perf_ScriptInverseUndoes`,
  `Law_Perf_ScriptInverseUndoesFromFive`, `Law_Perf_ScriptInverseUndoesOnCylinder` with their helpers
  (`ScriptInverseUndoesOn`, `ScriptRoundTrips`, `ScriptInverseUndoesOver`), named as the supervisor's convention says;
  the verdicts file gains two rows.
- `Law_RemapIsIdentityForGeometricEdits` (:328) body => `Law_Perf_RemapIsIdentityForGeometricEdits`'s, with
  `RemapIsIdentityOn` and `RemapIsIdentityFor`; `Law_ComposeWithIdentityIsIdentity` (:341) body =>
  `Law_Perf_ComposeWithIdentityIsIdentity`'s, with `ComposeWithIdentityOn` and `SameRemap`.
  `RemapIsIdentityForGeometricEditsAt` and `ComposeWithIdentityIsIdentityAt` then have no caller.

Layer 11 (move `repair-indexed.types.plato` and `repair-indexed.library.plato` into `11-repair/`):
- `FacesAtVertex(m, v)` (repair-diagnosis.library.plato:30) => `m.FacesAtVertexByCoedges(v)`
- `FacesOnCurve(m, c)` (:35) => `m.FacesOnCurveByCoedges(c)`
- `CostOf(m, a)` (:142) => `m.CostOfBound(a)`
- `PlanOf(m, defects)` (:267) => `m.PlanOfIndexed(defects)`
- `Diagnose` and `IsInClosedShell` stay: single-defect callers and the agreement laws' oracle. Once
  `FacesAtVertex` and `FacesOnCurve` are wired, `Law_Perf_FacesAtVertexByCoedgesAgrees` and
  `Law_Perf_FacesOnCurveByCoedgesAgrees` compare a function with itself: keep the edge-scan bodies under another
  name as the oracle, or drop those two laws.

## Contract requests

- none

## Findings

- `BrepEditingLaws.Law_ScriptInverseUndoes` times out under `--budget=2` compiled before this chunk (3.59 s at baseline,
  4.47 s in a busier run); the verdicts file has it as pass (no budget).
- Probe (not committed): on the unit box, `SameModel(m, m)` costs about 33 us and `IdentityRemap` about 6 us under the
  compiled runner. Every applied edit builds a full `IdentityRemap` in `AppliedInPlace` (editing-outcome.library.plato
  :174) whatever the script does with it, and `WithFaceRemap` builds one for RemoveFace and RestoreFace. Together these
  are most of the script laws' time. `EditOutcome.Applied` holds the remap by value, so avoiding the build is a
  contract change; building `IdentityRemap` straight to typed indices (one MapRange per table instead of
  `IdentityNewOf` and a `Map`) would halve its allocations with no contract change.
- Layer 2's `CountsAsEdge` evaluates `IsEveryIndexInRange` (the whole model) per edge, so layer 8's `IsClosedShell` is
  O(E M) per shell. `RepairIndex` binds it once (`IsClosedShellIndexed`); `IsClosedShell` and its other callers still
  pay it.
- The warm server (`plato_laws.py --staging`) found this folder's laws on the first run, unlike perf-sites'.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan rows, layers 10 and 11, E1 and V4 tables, witnesses) | 20 min | |
| Baseline compiled run of the two law blocks | 1 min | 1 |
| Writing libraries and laws | 30 min | |
| Warm interpreter runs | 1 min | 2, all pass |
| Compiled runs | 4 min | 4 |
| Profiling probe (scratch, not committed) | 1 min | 1 |
| Splitting the script law and narrowing two agreement laws' index sets | 5 min | |
| TRACK, ticket, commit | 8 min | |

## Lessons

- Law times under the 22-thread compiled runner moved by half between runs; a law at 1.4 s alone measured near 2 s in
  a run with the library's laws. Measuring the chunk's laws alone, then with the row's laws, showed which was which.
- A probe law per suspected cost (identity remaps, SameModel, Apply alone), in a scratch copy of the folder, found the
  script law's costs in one compiled run.
