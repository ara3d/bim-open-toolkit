# v1-jody: small closed B-spline loops of the M2-JODY-W377 files discretized and meshed

Ticket: TKT-431, TKT-453
Status: merged: J1 in 8af85727, J2 in 964adf85, J4 in fd3db478, J3 in bf3ac6c0

## Chunks

| Id | Ticket | Goal | Expected |
|---|---|---|---|
| J1 | TKT-431 | The 24 one-edge plane loops of the two M2-JODY-W377 files discretized: a B-spline written unclamped in periodic form is decided closed from its record | 2 h |
| J2 | TKT-453 | A closed span whose ends coincide fails the segment test, so small closed loops are not meshed as triangles | 1 h |
| J4 | (supervisor's performance finding) | The other `Count.Range.Take(0)` empties replaced by one layer-0 helper, `Integer.NoIndices` (J4.patch) | 1 h |
| J3 | (supervisor's performance finding) | Reduced and ChangedSensePositions build a filter's empty case as `[k].Take(0)`, not an eagerly built `n.Range.Take(0)`: prepare no longer O(V^2 + E^2) | 1 h |

## Done

- J1 (TKT-431), commit 4f87bf74, about 2 h against 2 h. `EndsClosureWrapped` decides an unclamped B-spline in wrapped form closed from its record. Laws (block `V1JodyWrappedSplineClosureLaws`, cpu64): 5 pass. Corpus check on C# regenerated from library 55a3223c plus the fix: both M2-JODY-W377 files go from 12 undiscretized faces each to 0. No type added: the decision is a `DecidedClosure`, which exists. Details: TKT-431.
- J2 (TKT-453), see the commit, about 1.5 h against 1 h (most of it finding why the witness copy of the corpus spline splits where the corpus edge does not: its ends differ by rounding). `IsClosedSpan` fails a seed span from a point back to itself. Laws (block `V1JodyClosedSpanLaws`, cpu64): 3 pass, 8 with J1's. Corpus check with J1 and J2 wired in: the 10 circles of radius 0.5 and 0.45 mm per file go from 3 segments to 16; no other edge changes. No type added. Details: TKT-453.

- J3, see the commit, about 1 h against 1 h. `ReducedFlat` and `ChangedSensePositionsFlat` (`reduced-flat.library.plato`) are the library's functions with each `Count.Range.Take(0)` empty replaced by `[k].Take(0)`. Laws (block `V1JodyReducedFlatLaws`, cpu64): 2 pass, `ReducedFlat` gives `Reduced`'s model, repairs, diagnostics and sources on the 4 raw witnesses at their own and at the prepared tolerances, and `ChangedSensePositionsFlat` gives `ChangedSensePositions`'s positions on every witness loop, flipped or not; `Law_PrepareIsIdempotent` (4 cases) and `Law_PrepareKeepsPointSet` (56 cases) pass in the same run. Prepare time, C# regenerated from library 55a3223c with and without J3 wired in (harness `one --path host --parallel --warmup`, three runs each, alternating):

  | File | Edges | Prepare before (ms) | Prepare after (ms) | Total before (ms) | Total after (ms) | Digest |
  |---|---|---|---|---|---|---|
  | SHO/ELLA-W1.STEP | 20,684 | 4,757, 4,208, 3,356 | 238, 367, 441 | 6,226, 5,998, 5,114 | 2,118, 2,483, 3,453 | 7FC34C435864049C both |
  | POS/RCB-F9T(AP214).STEP | 20,166 | 3,587, 3,611, 3,753 | 228, 303, 271 | 8,434, 8,250, 8,311 | 5,008, 6,001, 4,722 | 89187A658888165C both |

  About 3.3 to 4.4 s saved per large file on this machine, a factor of 10 to 15 on prepare; the corpus figure the finding quoted (9.9 s on ELLA-W1) was measured under other load. No type added.

- J4, about 1.5 h against 1 h. Layer 0 gains `NoIndices(_: Integer): Array<Integer> => [0].Take(0)` beside `Corresponds`, the one place the idiom lives; nine library sites use it, and the staged J3 copies use it too. First committed in the library (662b6c51) on a misreading of "in place"; reverted in the next commit, which keeps the library diff as `J4.patch` and the helper as `no-indices.library.plato` for the staged J3 copies. Sites, with whether the host's meshing path reaches them (a name-level call graph over layers 00 to 08 from the functions StepPlatoMesher and StepPlatoTables call):

  | Site | Function | Size of the range built per rejected element | Meshing path |
  |---|---|---|---|
  | 02-topology/topology-faceted.library.plato:55 | CoincidenceRootsByGridCounted | n points | no |
  | 02-topology/topology-shell-tables.library.plato:261 | IndexedBoundaryCycleCountIndexed | n, per pair (cubic) | no |
  | 02-topology/topology.library.plato:849 | CornersAroundVertex | n corners | no |
  | 02-topology/topology.library.plato:994 | CoincidenceRootsPairwise | n, per pair (cubic) | no |
  | 05-face-meshing/triangulation-refine.library.plato:131 | PlaceInTriangle | 3 | yes (chordal refinement) |
  | 06-mesh/mesh-coincident-gridded.library.plato:75 | CoincidentVertexPairsGriddedCounted | n vertices | no |
  | 06-mesh/mesh-conversions.library.plato:62 | ToSplitTriangleMesh3D | count | no |
  | 06-mesh/mesh-elements.library.plato:124 | SliceOf | element count | no |
  | 06-mesh/mesh-incidence.library.plato:270 | CountsOfComponentIndexed | edge count | no |
  | 07-validation/validation-checks-topology-sparse.library.plato:134 | LinkComponentCountOf | n, per pair (cubic) | no |
  | 05-face-meshing/face-meshing.library.plato:363, 365 | CollapsedToTriangle | 4 | yes (Lift); not edited: the file holds another session's uncommitted edits. Two lines for the merge: `4.Range.Take(0)` => `Integer.NoIndices` |

  The quadratic and cubic sites are all in laws, checks and validation; the two on the meshing path build 3 or 4 elements. Laws: the 53 law blocks of layers 02, 05, 06 and 07 with J3's and the prepare laws, 462 pass, 0 fail, 6 skipped (function-typed parameters, unrelated). ELLA-W1, C# regenerated from HEAD ad646aa6 without and with J4 (0 degraded bodies each), three alternating warm runs: faces 350, 232, 318 ms without and 295, 254, 218 with, edges 586, 497, 508 and 584, 522, 503, digest 7FC34C435864049C in all six: no difference beyond noise, as the 3- and 4-element sites predict. (Prepare is still 3.2 to 4.3 s there: J3 is not in ad646aa6.)

## Merge instructions

J1 (TKT-431):
- `wrapped-spline-closure.library.plato` (block `V1JodyWrappedSplineClosure`) into `03-step`, beside `EndsClosure` in `step.library.plato`.
- `EndsClosure(d, tol)` => `d.EndsClosureWrapped(tol)`, or move `EndsClosureWrapped`'s body into `EndsClosure` and delete it; the comment above `EndsClosure` and layer 3's README ("Closure at decode") then say an unclamped record in wrapped form is closed.
- `wrapped-spline-closure.laws.plato` (block `V1JodyWrappedSplineClosureLaws`) into `08-pipeline`: `Law_V1Jody_ClosedEdgeDiscretizes` reads layer 4's `DiscretizeAllRanged`. After the rewire, `IsClosedOnlyWrapped`'s clause `d.EndsClosure(tol).IsDecided.Not` becomes false: drop that clause, and `Law_V1Jody_DecidedUnchanged`, which then compares a function with itself.

J2 (TKT-453):
- In `BisectionCached.SegmentFailsCachedCounted` (`04-discretization/discretization-ranged-bisection.library.plato`), first: `if (m.IsClosedSpan(a, b)) { return Counted(true, Projections(0)); }`, with `IsClosedSpan` moved beside it from `closed-span.library.plato`; then delete `SegmentFailsClosedCounted`, `SplitSpanClosedCounted` and `BisectedClosedCounted`, which are the library's functions with that one call changed. `SegmentFailsOrderedOn`, which the findings' floor count calls with parameters, gets the same first test (`a != b` and the two points within the length tolerance).
- `closed-span.laws.plato` (block `V1JodyClosedSpanLaws`) into `08-pipeline` beside the J1 laws (it reads `JodyEdge` and the records there). After the rewire `LibraryBisection` and `ClosedSpanBisection` are one function: `Law_V1Jody_ClosedSpanSplits` keeps its closure, count and angular clauses and drops `LibraryBisection(...) == 1`; `Law_V1Jody_OpenSpansUnchanged` and `Law_V1Jody_NearlyClosedSpanUnchanged` then compare a function with itself and go.

J3:
- `03-step/step.library.plato`, `Reduced`: in `merged`, `drops` and `unsettled`, the `Count.Range.Take(0)` empty => `Integer.NoIndices` (the body of `ReducedFlat`; layer 0's helper from J4).
- `03-step/step-loop-chaining.library.plato`, `ChangedSensePositions`: both `before.Count.Range.Take(0)` => `Integer.NoIndices` (the body of `ChangedSensePositionsFlat`).
- Then delete `reduced-flat.library.plato` and `reduced-flat.laws.plato`: after the edit both laws compare a function with itself; `Law_PrepareIsIdempotent` and `Law_PrepareKeepsPointSet` keep the check. The other empties are J4's.

J4:
- `git apply sandbox/step-mesh-staging/v1-jody/J4.patch` (11 hunks, 10 files: the helper in 00-foundation/foundation.library.plato and the nine sites in the table above), then delete `no-indices.library.plato`.
- `05-face-meshing/face-meshing.library.plato`, `CollapsedToTriangle`, lines 363 and 365: both `4.Range.Take(0)` => `Integer.NoIndices` (not in the patch: the file held another session's edits).

## Contract requests

- None.

## Findings

- STEP's `closed_curve` flag is not kept (layer 1, "B-spline records"); the record test reads the geometry instead, as the layer intends.
- C# regenerated from library 55a3223c meshes M2-JODY-W377-00C_PCIE-UART to 3,260 triangles where the committed C# (bim-open-data e646e28) gives 6,698: 256 plane faces get fewer triangles each (face 30: 24 to 10). Not this track's change; it comes from library commits after the committed C#. Worth a look before the next regeneration is committed.
- A span with a chord of rounding noise (ends 1e-14 apart) fails the tangent test by accident and is split; one with exactly equal ends passed until J2. Both now fail by `IsClosedSpan`.

## Durations

| Step | Wall time (min) | Runs |
|---|---|---|
| Reproduce (harness build, one file) | 2 | 1 |
| Trace J1's cause (library reading, STEP records) | 25 | 0 |
| Laws, J1 and J2 | 10 | 9 law runs |
| Regenerations, harness builds, corpus runs | 20 | 5 regenerations, 5 builds, 9 runs |
| Trace J2's cause (probe laws, C# probe over the decoded model) | 20 | 4 law runs, 1 probe |
| J3: staging and laws | 10 | 3 law runs |
| J3: regeneration (one failed on a newer bim-open-data script) and timing | 15 | 2 regenerations, 1 build, 12 timed meshings |
| J4: edits, call graph, laws | 15 | 2 law runs (one 100 s sweep) |
| J4: regenerations and timing | 12 | 2 regenerations, 2 builds, 6 timed meshings |
| J4: moving the library edit into staging | 5 | 1 law run |

## Lessons

- Edit nothing under `sandbox/step-brep-mesh`, even when a supervisor says "in place": ask whether it means the merge's form or the tree. J4 went into the library while a merge agent was working in the same layers and had to be reverted.
- A baseline regeneration must use the same library commit as the scratch copy; the first baseline used an older commit and had to be redone.
- Comparing library trees with `git rev-parse <commit>:<path>` is instant; extracting each commit to diff took 2 minutes for nothing.
- A witness copied from a corpus record does not reproduce a defect that turns on exact equality of evaluated points: the corpus edge's ends were equal, the copy's differed by rounding. A C# probe over the decoded model found that in one run; a witness built so equality holds by construction (a clamped loop) then showed the defect.
- bim-open-data's `regen-step-brep.ps1` at 48420e3 reads `tools/shipped-program.txt` from the library commit, so it cannot regenerate a library commit from before that file; check out the script's commit that matches the library first.
- Plato's `&&` in a law did not short-circuit an index past an array's end; use `?:`.
