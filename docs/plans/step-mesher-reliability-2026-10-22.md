# STEP mesher reliability: why defects pass the specs and laws, 2026-10-22

Track v1-reliability of the version 1 wave (epic TKT-323; supervisor session local_c001d6a6). The STEP mesher is a
Plato library (`sandbox/step-brep-mesh`, layers 00 to 11) with types, spec blocks and about 1,320 laws, compiled to C#
(`Ara3D.StepBrep` in bim-open-data) and called by `StepPlatoMesher`. The design premise (`SPEC-EXECUTION.md`) is that
specs and laws make the generated code correct. This report takes every defect found since 2026-10-17, records how
it was found and why no law caught it, groups the causes, and turns them into ranked changes.

## Summary

- **40 defects in the mesher or its generated code** were found since 2026-10-17. A law caught 9 of them, and only 5
  of those in time: the other 4 sat behind budget errors for days. The corpus run and the public samples found 15, the
  C# build and its timing 8, a compiled law sweep 3, the gallery by eye 2, and reading or measuring 3.
- **23 defects in the checking apparatus itself**: laws that say nothing, laws that throw instead of failing, and a
  law server that answers "0 laws" when it did not compile.
- **The specs and laws work as a regression net for code they are run against.** About 1,190 laws pass. Fast bodies
  are tied to reference bodies by agreement laws: 41 performance chunks changed hot loops, and the corpus files
  the v1-edges track compared came out byte-identical. Laws also caught real geometry defects where a witness reached
  the case: the refinement stopping short on the sphere, the volume oracle counting pole loops twice, and the bump's
  degenerate element.
- **They do not make the shipped mesher correct on real files**, for five reasons that account for 33 of the 40
  defects. The witnesses do not reach the corpus's cases (13). The C# differs from the interpreter the laws ran in
  (7). The host meshes with settings or steps the laws never see (5). Budget errors hid failing verdicts (5).
  Compiler output degraded silently (3).
- **Four changes are built** (commits below). The corpus harness now checks the version 1 contract on every face of
  every file, and it catches TKT-415 (the flat quad on the bump), which every law passed. It also catches 33 faces of the
  moon_buggy sample that break the contract, which no ticket names but two staged fixes cover. A stub check fails on the
  generated code that cost 22,410 faces (TKT-410). The law runner fails on skipped laws, reruns budget errors alone,
  and writes a coverage table. A lint finds 16 guards that do not guard and 6 staged laws that will say nothing after
  merge. Five more changes are filed as requests to other tracks.

## Sources and method

Read: `sandbox/step-brep-mesh/reviews/FINDINGS.md` (F-1 to F-60), `reviews/verdicts-cpu64.tsv` (1,325 verdicts: 1,188
pass, 33 fail, 6 error, 84 obligation, 14 skipped), the corpus reports `docs/plans/step-mesher-corpus-2026-10-19.md`
and `-2026-10-21.md`, tickets TKT-337 to TKT-430 (a subagent tabulated TKT-337 to TKT-419, and TKT-420 to TKT-430
were read directly), the `TRACK.md` files of v1-compiler, v1-gate, v1-faces and v1-edges, the shared notes of the
wave, Plato's `LawRunner.cs` and `DifferentialRun.cs`, `plato_laws.py`, and the corpus harness. The perf chunks
TKT-357 to TKT-397 are counted only where a ticket records a defect (TKT-369, TKT-389, TKT-391, TKT-394). "Found by"
quotes the ticket or finding; "why not" is the source's reason where it gives one, and mine, marked *(inferred)*,
where it does not.

## Defects in the mesher and its generated code

| Defect | Found by | Law that should have caught it | Why it did not | Class |
|---|---|---|---|---|
| TKT-346 edge discretization never returns on an edge off its surface | C# wiring test run (646 s hang) | the termination laws added by the fix | no witness had an edge off its surface | B |
| TKT-347 writer drops a function whose first parameter is `List<T>` | C# compile error | none possible in the interpreter | laws ran in the interpreter | E |
| TKT-348 `PrepareModel` throws on a bodiless `BSplinePoint`; 72 of 88 files mesh nothing | corpus run | `Law_DecodeIsTotal` | it is one of the 84 host-obligation laws, recorded and never evaluated; `Reduced` is one host call | D |
| TKT-349 plane faces of 80 to 212 edges take minutes | corpus run | none (a cost) | "TKT-343 tested witnesses with a few edges" | B |
| TKT-350 lazy `MapRange` recomputed per read; the cylinder took over 10 minutes | C# timing | none | "the interpreter's call cache hides this" | E |
| TKT-351 constrained Delaunay refinement 2 to 3 times slower | C# timing | track F's laws | they were budget errors, read as noise | G |
| TKT-352 slivers along long boundary segments | `Law_RefinedInteriorMeetsMinAngle` | caught | (quality; deferred by the owner) | caught |
| TKT-353 lambda as the receiver of an extension call (CS0023) | C# compile error | none possible in the interpreter | laws ran in the interpreter | E |
| TKT-355 generated `Equals` compares arrays by reference | first compiled sweep | `Law_WitnessIsSameAsItself` and two more | they passed in the interpreter, which compares element-wise | E |
| TKT-356 85 laws over the 2 s budget compiled | first compiled sweep | none (a cost) | the interpreter memoizes pure calls (`CallMemo.cs`) | E |
| TKT-398 generic helper not monomorphized | compiled backend threw while building | none possible in the interpreter | writer gap, no message | F |
| TKT-399 cone apex slivers (gate) and the curved-face checks | the six `*FaceChecksHold` laws | caught late | "recorded as 120 s budget errors, so their verdicts were never seen" | G |
| TKT-400 implicit edge keys overflow 32-bit `Integer` past 32,768 poly points | reading code | none | no witness of that size | B |
| TKT-401 degenerate element on the bump's top | `Law_BumpSolidValidatesStructurally` | caught late | "Oracle validation does not finish compiled, so the verdict file recorded budget errors" | G |
| TKT-406 the 15 degree normal-turn criterion cannot be met on chords over 30 degrees | measurement (run C) | none until `Law_SideNormalsTurnAttainable` was added | no law said a criterion must be attainable | I |
| TKT-410 `SagittaByHullBoundGiven` compiled as a throwing stub; 22,410 faces unmeshed | corpus run | none | the stub exists only in C#; CHK304 was never printed; DEGRADED was one log line | F |
| TKT-411 30 three-edge sphere, cone and cylinder faces throw | corpus run | `Law_EmptyMeshIsExplained`, `Law_MeshedFaceHasSimpleRegion` | no polar lune at half a turn among the witnesses; `IsBandPair`'s `&&` read `winding[1]` | B (and H) |
| TKT-412 45 plane faces not simple: 32 file crossings, 6 chord artifacts, 7 touches | corpus run | none for the file defects | the 6 chord artifacts would mend if the host acted on refinement requests (v1-gate) | D |
| TKT-413 MAYA meshes with non-manifold and misoriented edges | corpus run, `MeshCheck` | `Law_LoopsChainEndToStart` | it was run on synthetic witnesses, never on a file's model | B |
| TKT-419 an edge written against its loop's vertex chain | v1-gate's script over the 8 files | `Law_LoopsChainEndToStart` | same | B |
| TKT-414 NINA-B222 edges never return | corpus run | the termination laws | "bounded the loops for the kinds it had witnesses for" | B |
| TKT-415 the bump's B-spline top meshed as one flat quad | gallery, by eye (digest equal to the unit box's) | `Law_ElementDeviationWithinSurfaceChordal`; the grid's keep rule | the witness laws meshed with triangles (`MeshedWitness`) while the host prefers quads (TKT-405); layer 5's element laws ran on 25 generated `FaceMesh` values; the grid was kept on boundary chordal alone | D (and C) |
| v1-faces F1: the grid broke chordal on every doubly curved four-sided face (torus, sphere zones) | a scratch law written after TKT-415 | same | same | D (and C) |
| TKT-420 needle cone faces fold at the apex | v1-edges probe, `MeshCheck` | `Law_ElementFacesFaceNormal` | no needle cone witness | B |
| TKT-421 needle cones and single-winding cylinders keep folded elements | corpus files on a scratch regeneration | `Law_ElementFacesFaceNormal` | no such witness | B |
| TKT-422 a file with entity short names decodes to no faces | public sample (clip.stp) | `Law_FaceCountMatchesInstances` | an obligation law, never run; no witness file uses short names | D |
| TKT-426 `Law_WellFormedBSplineKeepsRecord` fails compiled, passes interpreted | control run, both backends | the law | the baseline verdict file came from the interpreter | E |
| 24 B-spline edges in two JODY files return 0 segments with no exception (no ticket yet) | corpus run (v1-compiler) | an every-edge-discretized-or-reported law | no witness | B |
| F-50 a conditional used as a condition loses its parentheses, about 97 sites | spike reading the C# | none possible in the interpreter | "no front-end gate can see this; only a writer test can" | E |
| F-57.2 refinement stops short on a long-sided sphere triangle | `Law_SphereFaceChecksHold` | caught | | caught |
| F-57.3 `Oracle_BodyVolume` counts redundant pole loops | a law | caught | | caught |
| F-53.2 `WitnessIsOracleClean` at k = 5; a negative index in `ValidationIsIdempotent` | laws, once the profile let them finish | caught late | the ten laws had been budget errors | G |
| F-57.4 the hemisphere's mesh law ran 1,277 s and was removed unverified | a law run | the removed law | budget, then removal instead of a verdict | G |
| TKT-425 `Law_SagittaIsAttained` fails on fixture 12 | law sweep | caught | | caught |
| F-58.1 a generic type variable collides depending on program size | compile error | none | compiler defect, no message pointing at it | F |
| F-52 ear clipping and centroid splitting miss the criteria | `Law_TriangleMinAngleMeetsThreshold` (Info) | caught | | caught |
| v1-edges E1: the coedge-flip repair passes `MeshCheck` but keeps 352 degree arcs | the track reading the geometry | none | a closed-and-oriented check cannot see geometry; a chordal check against the surface can | C |
| TKT-428 sphere faces over-refine near poles, up to 19,600 triangles | public sample (moon_buggy) | none (quality and cost) | no pole-adjacent witness at this scale *(inferred)* | B |
| TKT-429 a torus band meshed on the wrong half of its tube; 180 misoriented edges | public sample, `MeshCheck` | the chordal and orientation laws | no torus band bounded by two full circles *(inferred)* | B |
| TKT-430 two-circle cylinders whose vertices are not on one generator get no grid; up to 51,768 triangles | public sample | none (quality and cost) | no such witness *(inferred)* | B |

## Defects in the checking apparatus

| Defect | Source | Class |
|---|---|---|
| 14 laws skipped (eight B-spline surface validity laws: no witness returns `BSplineSurfaceData`; six: function-typed parameters), and the runner exited 0 | `verdicts-cpu64.tsv` | A |
| `Law_PendingRequestIsInSomeOutcome` holds vacuously: no witness has a pending request | `08-pipeline/pipeline-witnesses.laws.plato` | A |
| Staged laws that compare staged code with the library's say nothing after the merge: `Law_BoundedAgreesOnConsistentModels`, `Law_MinAngleNoWorseThanLibrary` (F-56), `Law_Prepare_PreparationAgreesWhereDecided` (F-59), `Law_V1Edges_RankedKeysAgree`, `Law_V1Faces_GridKeptUnlessCurvedBothWays`, and 6 more staged today (lint below) | F-56, F-59, TRACK.md files | A |
| "Iff" laws restate the library predicate; `Law_InRangeModelIffIndicesInRange` is one-sided; `Law_RigidFrameIsOrthonormal` is likely vacuous on random frames | F-58, proofs track | A |
| String-typed WHERE laws are vacuously true or false on a misspelt name | F-1 | A |
| The Euler oracle calls the rule it checks | F-48.1 | A |
| `SameModel` ignores pcurves, loop and body cases | F-51.1 | A |
| The interpreter cannot build `CappedWitness`: six laws pass compiled and are skipped on the warm server | F-60 | E |
| 23 validity laws of layers 0 and 1 fail on generated values: no precondition (TKT-423) | v1-gate V1G-5 | H |
| `Law_SegmentFloorMet` takes any discretization (TKT-424); layer 6 invariants on arbitrary meshes; laws pairing a model with an unrelated mesh | F-54, V1G-5 | H |
| `SameUvPoints` guards with `&&`, so a size mismatch throws (an error) instead of failing | v1-gate | H |
| A law's `var` is evaluated before a later guard | F-59 | H |
| The `Integer` domain is -1 to 12: a selector over 28 samples misses half of them; five-parameter laws get 25 random cases | F-58, F-59 | H |
| Layer 5's element laws over a `FaceMesh` parameter pass on 25 generated meshes no `MeshFace` built | v1-gate | C |
| Seven laws flip between pass and a budget error at 2.0 to 2.5 s with 22 threads busy | v1-gate V1G-2 | G |
| The warm server answers "0 laws, 0 type errors" on a parse failure (TKT-337), an unresolved symbol (F-60), or a payload-free qualified case (F-58) | tickets, findings | F |
| The server keeps stale paths and misses LINT001 (F-58); the runner missed bare names and MSYS paths (TKT-427) | F-58, TKT-427 | F |
| The mathematical review: 12 false or imprecise laws, 4 false theorems, 11 missing laws | F-2 to F-44 | A, I |
| 33 `Undecided => true` arms in the proof laws (18 in layer 8, 14 in layer 7, 1 in layer 1): a law passes when its checker declines to decide | v1-types, through the supervisor | A |
| The V1G-1 merge (7a59273d) moved two quality laws to `10-editing` while layer 7 still calls them: layers 00 to 08 alone, the program the regeneration compiles, fail with 12 symbol errors, and the merge check passed because the warm server compiles every folder together | supervisor | J |

## Classes

Each class lists its product defects (P) and apparatus defects (T), the check that would have caught them, and that
check's cost.

| Class | P | T | The check that catches it | Cost |
|---|---|---|---|---|
| **A. Laws that pass without testing**: skipped, vacuous, passing on `Undecided`, or comparing a function with itself | 0 | 9 | Count each law's cases and the cases where its premise held; fail on skipped and vacuous laws; flag staged comparisons before the merge | Skips: none (built, TKT-434). Premise counts: a runner change (about 2 h, TKT-437). Staged comparisons: a lint (built, TKT-440) |
| **B. Witnesses do not reach the corpus's cases**: lunes, needle cones, surface curves with pcurve masters, edges against their loop, large shells | 13 | 0 | The contract checked on every corpus file's own mesh (built, TKT-432), then each failing face extracted as a witness so a law reaches it (TKT-439) | A corpus run is about 18 minutes on 22 cores; the contract adds 4 to 9 s per file. Extraction: about 2 h to build, then minutes per face |
| **C. Properties stated on parts or generated values, not on the mesh a file produces** | 1 (and secondary on 2) | 1 | The same contract check: chordal by sampling against the surface catches the flat quad and the 352 degree arcs that `MeshCheck` cannot | As B |
| **D. The host does work, or uses settings, the laws never see**: quads preferred, no refinement loop, obligation laws never run | 5 | 0 | One definition of the host's criteria in layer 8, used by the host and by the witness laws (TKT-436); the 84 obligation laws run compiled on each corpus file (TKT-441) | About 1 h for the criteria (layer 8 and the host); about 2 h for the obligation laws (regeneration and harness) |
| **E. Interpreter and compiled C# differ** | 7 | 1 | The differential run (Plato's `DifferentialRun`) over every witness and every law under 2 s, in each sweep (TKT-438) | A CLI option, about 1.5 h; the interpreter arm is slow (75 minutes for 130 laws), so it runs on laws under 2 s compiled |
| **F. Compiler and server output that degrades silently** | 3 | 3 | Fail the regeneration on any degraded or unlisted bodiless stub (built, TKT-433); an empty run is a failure (already in `plato_laws.py`) | Seconds per regeneration |
| **G. Verdicts that cannot be told from load** | 5 | 1 | Rerun each budget error alone with a larger budget before recording it (built, TKT-434) | Minutes per sweep |
| **H. Traps of the law language**: `&&` and `||` evaluate both operands, a `var` before its guard, no precondition on generated values | 0 (secondary on TKT-411) | 6 | A lint for guards that do not guard (built, TKT-440); laws over a function's inputs, not over arbitrary values (F-54's rule, already decided) | Under 1 s per run |
| **I. No law states the property** | 1 | 1 | A review of each layer's spec against the contract; the mathematical review did this for layers 0 to 6 | A reviewer session per layer |
| **J. A check runs a different program than the one shipped** (the warm server compiles every folder; the regeneration compiles layers 00 to 08 alone) | 0 | 1 | Type-check the shipped folder set on every merge check and law run (see below) | 15 to 25 s cold with the pinned CLI; under 1 s warm with no edit |
| Caught by a law in time | 5 | | | |
| **Total** | **40** | **23** | | |

## Two cases added after the first version

**Laws that pass on `Undecided`** (class A). 33 proof laws match a decided result and answer `Undecided(r) => true`
(layer 8: 18, layer 7: 14, layer 1: 1). A checker that declines to decide on every witness makes all of them pass,
which is the vacuity of class A in another form. The 3 such arms in `00-foundation/foundation-decided.spec.plato` are
invariants and carry no claim, so they are fine. Proposed rule: in a law, `Undecided` is not a pass. Either the law
returns its premise result through a `Premise_<Law>` companion (TKT-437), so a law undecided on every case is
reported vacuous, or, until TKT-437 lands, each such law gets a companion `Law_<Name>Decides` that some witness gives
a decided result. Then a checker that gives up everywhere fails a law, and one that gives up on some cases does not.
`law_lint.py` can list the arms; adding that check is a small follow-up to TKT-440.

**A check on a different program than the one shipped** (class J). The V1G-1 merge passed its warm-server check,
while layers 00 to 08 alone did not compile. Should the warm server compile the regeneration's folder set by default?
**Yes, for the type check; no, for the law run.** The laws of layers 09 to 11 must still run, and they need those
layers. So `plato_laws.py` should run two compilations:
- the shipped set first: the stdlib tiers without `brep.*`, `remeshing.*` and `lattices.*`, and layers 00 to 08
  without spec files, exactly what `regen-step-brep.ps1` and `tools/compile-layers-00-08.sh` compile, as a type
  check only (`filter none`);
- then the whole program, for the laws.

A type error in the first fails the run. The server keeps each folder set compiled, so the first check costs under a
second when nothing changed. Its price is memory: F-58 saw the server grow to 2.8 GB on many fresh paths, and the
set is one fixed path, not a fresh path per call. This belongs in `plato_laws.py` (this track's fence). The merge
agent's 00-to-08 compile with the pinned CLI is the same check, run cold once per merge; both can stay.

Built afterwards: `tools/shipped-program.txt` holds the folder list, and both `plato_laws.py` and
`compile-layers-00-08.sh` read it. Testing the check on a copy of the library at 7a59273d showed a second cause. The
server did report the 12 unresolved symbols, as `ok: false` with an `errors` list, but with 0 type errors, and
`plato_laws.py` read only `typeErrors`. So the merge check would have passed on any folder set. The script now prints
the compilation's own errors and fails on them, in the shipped check and in the law run. It is the same defect as
TKT-337 ("0 laws" on a parse failure), which the earlier mitigation had only turned into "no laws matched". At
7a59273d the shipped check reports 14 errors in 2 s warm, and the pinned CLI fails the same copy in 52 s. Today both
pass the shipped set, while the whole working tree does not compile: a "Circular expression" in an uncommitted edit
outside layers 00 to 08, which the script used to report only as "no laws matched".

## Verdict: are the specs and laws working?

Where they work: the laws hold the library to itself. The 1,188 passing laws, most of them agreement laws between
a fast body and its reference, let 41 performance chunks rewrite hot loops without changing a mesh. Where a witness
reaches a case, a law finds real geometry defects: the sphere's refinement stopping short (F-57.2), the volume oracle
(F-57.3), the bump's degenerate element (TKT-401), the sagitta fixture (TKT-425). The specs also fixed design
questions early: the mathematical review found 12 false laws before any code depended on them.

Where they do not work: on the question the project cares about, whether a real file's mesh meets the version 1
contract. The laws never saw a real file's mesh. Of the 40 defects, 15 were found by running the corpus or the public
samples, and 2 by looking at the gallery; no law could have found them, because every law runs on synthetic witnesses
meshed with settings the host does not use, through an interpreter whose results the C# does not always repeat.
The premise "specs and laws make the generated code correct" holds only for code paths that a witness reaches, run on
the backend that ships, with the host's settings, and with a verdict that is not a budget error. Today none of those
four conditions is checked; each change below makes one of them checked.

## Ranked changes

Ranked by defects caught per hour of work, with the classes above.

| Rank | Change | Ticket | Classes | Owner | State |
|---|---|---|---|---|---|
| 1 | The corpus harness checks the version 1 contract on every face of every file | TKT-432 | B, C, D | this track | **built**, bim-open-data d8bb198 |
| 2 | The regeneration fails on any degraded body or unlisted bodiless stub | TKT-433 | F | this track (check), v1-close (wiring) | **check built**, toolkit b6992ff4; wiring requested |
| 3 | `plato_laws.py` fails on skipped laws, reruns budget errors alone, writes a coverage table | TKT-434 | A, G | this track | **built**, toolkit f10d2d33 |
| 4 | The witness laws mesh with the host's criteria, from one definition in layer 8 | TKT-436 | D | supervisor (layer 8), v1-proof (`StepPlatoMesher.cs`) | requested |
| 5 | A lint for guards that do not guard and for staged comparisons | TKT-440 | A, H | this track | **built**, toolkit 920e869a |
| 6 | The law runner counts premise-held cases and reports vacuous laws as failures | TKT-437 | A | v1-compiler (Plato) | requested |
| 7 | The differential run, interpreter against compiled, over every witness in each sweep | TKT-438 | E | v1-compiler (Plato) | requested |
| 8 | A failing corpus face becomes a witness: the harness writes it as a Plato literal | TKT-439 | B | this track, next | filed |
| 9 | The 84 host-obligation laws run compiled on every corpus file | TKT-441 | D | v1-close (regeneration), this track (harness) | filed |

## What was built

1. **TKT-432, bim-open-data d8bb198**: `tools/step-corpus-harness/ContractCheck.cs` and its wiring into the time, one,
   all and gallery modes. Written from the face meshes and the surfaces alone, not from layer 7's checks:
   - Chordal: the surface at seven sample points of each element's parameter triangle, measured against the flat
     element, on both diagonal splits of a quad. The allowance is the chordal bound, plus the length tolerance, plus
     the largest corner-to-surface gap, which the file is answerable for.
   - Orientation: each element's normal against the face normal at its parameter centroid.
   - Degenerate elements: zero area.
   - Coverage: every face meshed or explained by a diagnostic.

   Evidence, on the library compiled at bim-open-data e646e28 (Plato c8c83c8b):
   - `gallery witness:BSplinePatchSolid:0.3 --chordal 0.01` breaks the contract (1 face over chordal, excess 0.065),
     where `MeshCheck` says closed and oriented.
   - The unit box and the cylinder hold.
   - NINA-B400, LENA-R8, MAYA-W160 and MAYA-W260_REVC hold at the host's 1 mm bound, 4 to 9 s per file in all.
     `MeshCheck` still reports MAYA-W260_REVC's 4 misoriented edges (TKT-413, fixed by v1-edges E1, not yet merged).
   - STEP Tools' moon_buggy_asm.stp (162 faces, 51 s with the check) breaks it on 33 faces, and each failure falls
     to a fix that is staged but not merged:
     - 14 whole tori meshed as grids of 1,144 quads, 1.89 mm from the surface against the 1 mm bound, and 2 B-spline
       grids at 3.8 mm. This is v1-faces F1's finding that the grid breaks chordal on doubly curved faces (TKT-415).
     - 3 cone faces with 565 flipped elements each, and 14 sphere faces with 4 to 25 each. These fit the apex and
       pole slivers of v1-gate V1G-3, which V1G-4's chordal-only refinement removes (TKT-399).
     - Rerun this file after both merge: it is the public check of those two fixes.
   - The check's limit: TKT-429's three torus bands pass it. Their grid lies on the surface, but on the wrong side of
     the two circles that bound the band, so only the assembled mesh's 180 misoriented edges (`MeshCheck`) show it. A
     per-face check needs the face's loops: each boundary side must run with its coedge. That is the next step for
     TKT-432's check, and it is not built.
2. **TKT-433, toolkit b6992ff4**: `sandbox/step-brep-mesh/tools/check_generated.py` and `generated-stubs.txt`.
   It fails on bim-open-data 5571854 (the TKT-410 stub) and passes on e646e28 (30 listed bodiless host obligations),
   in 0.5 s.
3. **TKT-434, toolkit f10d2d33**: `plato_laws.py`.
   - `--allow-skipped`: without it, a skipped law fails the run (`BrepCheckingLaws`: 6 skipped, exit 1).
   - `--rerun-budget S`: each budget error is rerun alone with S seconds. Tested with a stubbed server call, because
     the warm server answered from its cache.
   - `--coverage FILE`: the per-law table of cases.
   - The summary counts budget errors and the passes by how their cases were made.
4. **TKT-440, toolkit 920e869a**: `sandbox/step-brep-mesh/tools/law_lint.py`, 0.9 s, 22 findings, none accepted:
   - 16 guards that do not guard: the five `Same*` helpers of layer 5 and 7, the library's `IsBandPair` (one cause of
     TKT-411, mended by v1-faces F3 when it merges), and laws in layers 3, 4, 6, 7, 8 and 9 that throw instead of
     failing on a size mismatch.
   - 6 staged comparisons: v1-edges `Law_V1Edges_WitnessEdgeRangesKept`, v1-gate
     `Law_V1Gate_PinchRuleAgreesAwayFromPinches`, v1-jody's two closure laws, v1-types' two element-shape laws.

## Requests to other tracks

- **v1-close** (regeneration script, TKT-433): after the generation step, run
  `python -I sandbox/step-brep-mesh/tools/check_generated.py <output>/src/data/Ara3D.StepBrep/Generated --log <log>`
  and stop with its exit code. A deliberate new host obligation is listed with `--write-baseline`. For TKT-441: emit
  the laws whose only obligations are `ParseStep`, `DecodeRaw`, `FlatRecord`, `SlotOf` or `InstancePosition` into a
  law assembly the harness can reference.
- **v1-compiler** (Plato, TKT-437 and TKT-438): a `Premise_<Law>` companion, counted like `Measure_<Law>`, with the
  verdict `vacuous`; and `plato run --laws --differential` over every witness and every law under 2 s, exiting 1 on
  a mismatch.
- **supervisor and v1-proof** (TKT-436): a layer 8 function for the host's meshing criteria from a chordal bound
  (quads preferred, chordal-only refinement, the round limit). `StepPlatoMesher.Criteria` returns it, and
  `MeshedWitness` and the gate witnesses mesh with it.
- **every track, at merge**: run `law_lint.py`; drop or rename each staged comparison it lists, and give each `Same*`
  helper a `? :` guard (the 16 findings are in library and law files outside this track's fence).
- **the sweep owner**: record verdicts with `plato_laws.py --rerun-budget 120 --coverage` so a budget error in
  `verdicts-cpu64.tsv` is a settled verdict, and keep the coverage table beside it.

## Durations

Times are from commit and file timestamps; the machine ran about 22 other build and law threads throughout.

| Step | Wall time | Runs |
|---|---|---|
| Reading findings, tickets (one subagent, 97 s), tracks, corpus reports, runner and harness | about 30 min | 0 |
| Harness contract check: write, scratch build of bim-open-data HEAD, three witnesses | about 12 min | 4 builds (31 s, then 6 to 8 s each), 6 gallery runs |
| Harness on four corpus files, then moon_buggy_asm.stp | 2 min | 5 file runs, 4 to 9 s each and 51 s |
| Stub check: write, test on two generated folders | about 8 min | a 2 min first version (a regex on every line), then 0.5 s; 1 min 22 s extracting the old generated folder |
| Tickets: similar searches and nine tickets | about 6 min | 0 |
| `plato_laws.py`: rewrite, two runs on the warm server, an offline test of the rerun | about 10 min | 3 server runs (1 to 4 s) |
| `law_lint.py`: write, two refinements of the rule | about 10 min | 3 runs, 0.9 s each |
| Commits and pushes (one retry on another session's index lock) | 3 min | 4 commits |
| Report and track file | about 15 min | 0 |

## TKT-441: the library's laws on every corpus file

The 84 host-obligation laws are written over `Part21File`, and the C# host never builds one: it decodes its own
parse tree straight to a `RawDecodedModel`. So they cannot run on the host's path as written. What runs instead is
the compiled form of layer 7's laws: every generated `Check_*` method that takes only a `BrepModel`, or a model and a
sample plan. That is 180 checks, found by reflection, run on each corpus file's raw decoded model and on its prepared
model (`step-corpus-harness laws`, bim-open-data 638464d). The raw model is checked under the prepared model's
tolerances, because its own are zero until PrepareModel decides them: the first version showed every tolerance check
failing on it by construction. Each check gets 2 s, 8 at a time.

Cost: 4,803 s for the 88 files, median 55 s a file, against 779 s for the corpus meshing run. Most of it is checks
running their full budget (TKT-476). The run used bim-open-data 97495d8, before J5 merged, so NINA-B222's surface-curve
rows are J5's defect, now fixed.

Causes, one ticket each:

| Cause | Checks | Files | Ticket |
|---|---|---|---|
| The decided length tolerance is tighter than the file's own accuracy | EdgeLiesOnAdjacentSurfaces, VertexCoincidesWithCurveEnd, EdgeDomainEndsAtVertices | MAX, SAM (2), JODY-W4, JODY-W5/W6, ZOE_S-LGA51 (2), NORA-B120, B121, B126, ANN-MB2 | TKT-472 (new) |
| Closed shells never sewn | EveryEdgeUsedTwiceInClosedShell, DeclaredClosedIsClosed, VertexLinkIsOneCycle | MAYA REVC (3), THEO-P173, raw and prepared, so in the decoder | TKT-467 (existing) |
| A vertex link that is neither a cycle nor a path, after prepare | OpenShellVertexLinkIsCycleOrPath | M2-JODY-W377 (2) | TKT-473 (new) |
| A planar face's area disagrees with Green's formula | PlanarFaceAreaMatchesGreen | SAM (2) | TKT-474 (new) |
| A check reaches the bodiless `SecondDerivative` | SecondDerivativeMatchesCentralDifference and 3 more | ELLA-W1, NINA-B222 | TKT-475 (new) |
| A third of the checks cannot run on a real file | 6 always over budget, about 70 on nearly every file | all | TKT-476 (new) |
| Fixed by J5 since the run | SurfaceCurveLiesOnPcurve, CurveAgreesWithPcurve, PcurveRunsWithCurve | NINA-B222 | TKT-414, TKT-465 cause B |
| Mended by PrepareModel, as designed | LoopsChainEndToStart (raw only) | MAYA REVC (3) | v1-edges E1 |

The generated table (`python -I sandbox/step-brep-mesh/tools/laws_corpus_table.py <out folder>`):

88 files with a laws table; 88 files run; 0 not done (none); total 4803 s, median 55 s a file

| Check | Fails on raw | Fails on prepared | Over budget (raw, prepared) | First location |
|---|---|---|---|---|
| EdgeLiesOnAdjacentSurfaces | 15: POS_MAX (STEP-AP203).STEP, POS_MAX (STEP-AP214).STEP, POS_SAM_AP203.STEP, POS_SAM_AP214.STEP, SHO_BMD-301.STEP, SHO_BMD-340.STEP ... | 5: POS_MAX (STEP-AP214).STEP, POS_SAM_AP203.STEP, POS_SAM_AP214.STEP, SHO_JODY-W4.step, SHO_M2_JODY-W5 and W6 CARD.STEP | 51, 65 | Provenance.KernelFace(BrepFaceIndex(156)) |
| EdgeLiesOnAdjacentSurfacesHoisted | 15: POS_MAX (STEP-AP203).STEP, POS_MAX (STEP-AP214).STEP, POS_SAM_AP203.STEP, POS_SAM_AP214.STEP, SHO_BMD-300-330-360.STEP, SHO_BMD-301.STEP ... | 4: POS_MAX (STEP-AP214).STEP, POS_SAM_AP203.STEP, POS_SAM_AP214.STEP, SHO_M2_JODY-W5 and W6 CARD.STEP | 51, 66 | Provenance.KernelFace(BrepFaceIndex(156)) |
| EdgeDomainEndsAtVertices | 6: POS_ZOE_S-LGA51 (STEP-AP203).STEP, POS_ZOE_S-LGA51 (STEP-AP214).STEP, SHO_NINA-B222-W1x2.STEP, SHO_NORA-B120.step, SHO_NORA-B121.step, SHO_NORA-B126.step | 7: POS_ANN-MB2.step, POS_ZOE_S-LGA51 (STEP-AP203).STEP, POS_ZOE_S-LGA51 (STEP-AP214).STEP, SHO_NINA-B222-W1x2.STEP, SHO_NORA-B120.step, SHO_NORA-B121.step ... | 14, 20 | Provenance.KernelEdge(BrepEdgeIndex(1252)) |
| VertexCoincidesWithCurveEndHoisted | 7: POS_ANN-MB2.step, POS_ZOE_S-LGA51 (STEP-AP203).STEP, POS_ZOE_S-LGA51 (STEP-AP214).STEP, SHO_NINA-B222-W1x2.STEP, SHO_NORA-B120.step, SHO_NORA-B121.step ... | 6: POS_ANN-MB2.step, POS_ZOE_S-LGA51 (STEP-AP203).STEP, SHO_NINA-B222-W1x2.STEP, SHO_NORA-B120.step, SHO_NORA-B121.step, SHO_NORA-B126.step | 13, 27 | Provenance.KernelEdge(BrepEdgeIndex(1252)) |
| EdgeDomainEndsAtVerticesHoisted | 6: POS_ZOE_S-LGA51 (STEP-AP203).STEP, POS_ZOE_S-LGA51 (STEP-AP214).STEP, SHO_NINA-B222-W1x2.STEP, SHO_NORA-B120.step, SHO_NORA-B121.step, SHO_NORA-B126.step | 6: POS_ANN-MB2.step, POS_ZOE_S-LGA51 (STEP-AP203).STEP, POS_ZOE_S-LGA51 (STEP-AP214).STEP, SHO_NINA-B222-W1x2.STEP, SHO_NORA-B121.step, SHO_NORA-B126.step | 15, 23 | Provenance.KernelEdge(BrepEdgeIndex(1252)) |
| VertexCoincidesWithCurveEnd | 6: POS_ZOE_S-LGA51 (STEP-AP203).STEP, POS_ZOE_S-LGA51 (STEP-AP214).STEP, SHO_NINA-B222-W1x2.STEP, SHO_NORA-B120.step, SHO_NORA-B121.step, SHO_NORA-B126.step | 5: POS_ZOE_S-LGA51 (STEP-AP214).STEP, SHO_NINA-B222-W1x2.STEP, SHO_NORA-B120.step, SHO_NORA-B121.step, SHO_NORA-B126.step | 13, 24 | Provenance.KernelEdge(BrepEdgeIndex(2418)) |
| EveryEdgeUsedTwiceInClosedShell | 4: SHO_MAYA-W260_REVC.step, SHO_MAYA-W261_W271_REVC.step, SHO_MAYA-W266_W276_REVC.step, SHO_THEO-P173.STEP | 4: SHO_MAYA-W260_REVC.step, SHO_MAYA-W261_W271_REVC.step, SHO_MAYA-W266_W276_REVC.step, SHO_THEO-P173.STEP | 0, 2 | Provenance.KernelEdge(BrepEdgeIndex(2821)) |
| EveryEdgeUsedTwiceInClosedShellSparse | 4: SHO_MAYA-W260_REVC.step, SHO_MAYA-W261_W271_REVC.step, SHO_MAYA-W266_W276_REVC.step, SHO_THEO-P173.STEP | 4: SHO_MAYA-W260_REVC.step, SHO_MAYA-W261_W271_REVC.step, SHO_MAYA-W266_W276_REVC.step, SHO_THEO-P173.STEP | 0, 0 | Provenance.KernelEdge(BrepEdgeIndex(2821)) |
| OpenShellVertexLinkIsCycleOrPath | 5: SHO_M2-JODY-W377-00C_PCIE-UART.step, SHO_M2-JODY-W377-01C_SDIO-UART.step, SHO_MAYA-W260_REVC.step, SHO_MAYA-W261_W271_REVC.step, SHO_MAYA-W266_W276_REVC.step | 2: SHO_M2-JODY-W377-00C_PCIE-UART.step, SHO_M2-JODY-W377-01C_SDIO-UART.step | 0, 1 | Provenance.KernelVertex(BrepVertexIndex(2376)) |
| OpenShellVertexLinkIsCycleOrPathSparse | 5: SHO_M2-JODY-W377-00C_PCIE-UART.step, SHO_M2-JODY-W377-01C_SDIO-UART.step, SHO_MAYA-W260_REVC.step, SHO_MAYA-W261_W271_REVC.step, SHO_MAYA-W266_W276_REVC.step | 2: SHO_M2-JODY-W377-00C_PCIE-UART.step, SHO_M2-JODY-W377-01C_SDIO-UART.step | 0, 0 | Provenance.KernelVertex(BrepVertexIndex(2376)) |
| DeclaredClosedIsClosed | 3: SHO_MAYA-W260_REVC.step, SHO_MAYA-W261_W271_REVC.step, SHO_MAYA-W266_W276_REVC.step | 3: SHO_MAYA-W260_REVC.step, SHO_MAYA-W261_W271_REVC.step, SHO_MAYA-W266_W276_REVC.step | 1, 6 | Provenance.KernelShell(ShellIndex(217)) |
| PlanarFaceAreaMatchesGreen | 2: POS_SAM_AP203.STEP, POS_SAM_AP214.STEP | 2: POS_SAM_AP203.STEP, POS_SAM_AP214.STEP | 85, 85 | Provenance.KernelFace(BrepFaceIndex(7)) |
| LoopsChainEndToStart | 3: SHO_MAYA-W260_REVC.step, SHO_MAYA-W261_W271_REVC.step, SHO_MAYA-W266_W276_REVC.step | 0 | 0, 0 | Provenance.KernelLoop(BrepLoopIndex(1414)) |
| SurfaceCurveLiesOnPcurveHoisted | 1: SHO_NINA-B222-W1x2.STEP | 1: SHO_NINA-B222-W1x2.STEP | 2, 4 | Provenance.KernelCurve(CurveIndex(2926)) |
| CurveAgreesWithPcurve | 1: SHO_NINA-B222-W1x2.STEP | 0 | 1, 3 | Provenance.KernelEdge(BrepEdgeIndex(1463)) |
| CurveAgreesWithPcurveHoisted | 1: SHO_NINA-B222-W1x2.STEP | 0 | 1, 3 | Provenance.KernelEdge(BrepEdgeIndex(1463)) |
| EulerPoincareEvenAndBounded | 1: SHO_NINA-B222-W1x2.STEP | 0 | 47, 49 | Provenance.KernelShell(ShellIndex(49)) |
| PcurveRunsWithCurveHoisted | 1: SHO_NINA-B222-W1x2.STEP | 0 | 1, 2 | Provenance.KernelEdge(BrepEdgeIndex(1231)) |
| SurfaceCurveLiesOnPcurve | 1: SHO_NINA-B222-W1x2.STEP | 0 | 1, 10 | Provenance.KernelCurve(CurveIndex(2926)) |
| VertexLinkIsOneCycle | 1: SHO_MAYA-W260_REVC.step | 0 | 0, 5 | Provenance.KernelVertex(BrepVertexIndex(1953)) |
| VertexLinkIsOneCycleSparse | 1: SHO_MAYA-W260_REVC.step | 0 | 0, 5 | Provenance.KernelVertex(BrepVertexIndex(1953)) |
| PcurveSecondDerivativeMatchesCentralDifference | 2: SHO_ELLA-W1.STEP, SHO_NINA-B222-W1x2.STEP | 2: SHO_ELLA-W1.STEP, SHO_NINA-B222-W1x2.STEP | 0, 0 | NotImplementedException: plato: SecondDerivative is declared without a body |
| PcurveSecondDerivativeMatchesCentralDifferenceHoisted | 2: SHO_ELLA-W1.STEP, SHO_NINA-B222-W1x2.STEP | 2: SHO_ELLA-W1.STEP, SHO_NINA-B222-W1x2.STEP | 0, 0 | NotImplementedException: plato: SecondDerivative is declared without a body |
| SecondDerivativeMatchesCentralDifference | 2: SHO_ELLA-W1.STEP, SHO_NINA-B222-W1x2.STEP | 2: SHO_ELLA-W1.STEP, SHO_NINA-B222-W1x2.STEP | 2, 17 | NotImplementedException: plato: SecondDerivative is declared without a body |
| SecondDerivativeMatchesCentralDifferenceHoisted | 2: SHO_ELLA-W1.STEP, SHO_NINA-B222-W1x2.STEP | 2: SHO_ELLA-W1.STEP, SHO_NINA-B222-W1x2.STEP | 2, 17 | NotImplementedException: plato: SecondDerivative is declared without a body |

Checks over budget on every file and stage (6): ClosestParameterNoWorseThanSample, ClosestParameterNoWorseThanSampleHoisted, ProjectNearRecoversFromNearbySeed, ProjectNearRecoversFromNearbySeedHoisted, ProjectNoWorseThanSample, ProjectNoWorseThanSampleHoisted
Checks over budget on some (count of file-stages): OuterShellExactVolumePositive (175), ProjectIsStationaryHoisted (175), AreaElementMatchesCrossProduct (174), BSplineSurfaceMatchesBasisSum (174), ConeAreaElement (174), NormalOrthogonalToPartial (174), PartialMatchesCentralDifference (174), ProjectIsStationary (174), ProjectRecoversParameter (174), ScaledSurfacePointIsScaled (174), SurfaceCurvePcurveSameSense (174), SurfaceRepeatsWithPeriod (174), AreaElementPositiveAwayFromCollapse (173), ClosestParameterIsCanonical (173), NormalIsUnit (173), ProjectIsCanonical (173), TangentialPartialVanishesOnDegenerateSide (173), BSplineCurveMatchesBasisSum (172), ClosestParameterIsStationary (172), ClosestParameterIsStationaryHoisted (172), ClosestParameterRecoversPoint (172), CurveRepeatsWithPeriod (172), ExtrusionProfileTransverse (172), NormalSenseMatchesParameterization (172), OffsetReferenceNotTangent (172), ProjectNearRecoversParameter (172), ProjectRecoversPoint (172), ScaledCurvePointIsScaled (172), SphereAreaElement (172), TangentialPartialVanishesOnDegenerateSideHoisted (172), TorusAreaElement (172), PlanarFaceAreaMatchesGreen (170), EdgeReversalKeepsCoedgeSense (169), CoincidentEndsAreOneVertex (168), TrimmedRangeIsForward (168), TrimmedStartsAtSensedEnd (168), CompositeSegmentsBounded (167), RectangularTrimmedRangeIsForward (167), EdgeReversalKeepsEdgeDomain (166), PeriodicCurveIsClosed (166), BSplineCurveDomainIsKnotSpan (165), BSplineSurfaceDomainIsKnotSpan (165), PeriodicSurfaceSpansOnePeriod (164), DegenerateEdgeHasCoincidentVertices (163), PeriodicCurveSpansOnePeriod (163), EdgeDomainIsForward (162), EdgeHasPositiveExtent (160), LoopWindingMatchesSameSense (159), ParameterizationSignIsConstantOnFaceHoisted (124), ParameterizationSignIsConstantOnFace (123), EdgeLiesOnAdjacentSurfacesHoisted (117), EdgeLiesOnAdjacentSurfaces (116), ReducedEulerMatchesOracle (101), ReversingEveryFaceKeepsCoherence (101), ShellIsOrientable (97), EulerPoincareEvenAndBounded (96), ShellIsConnected (96), OpenShellEulerEvenAndBounded (92), PolyLoopEdgesPairUp (87), CollapsedLineIsOnePoint (46), VertexCoincidesWithCurveEndHoisted (40), CollapsedLineIsOnePointHoisted (39), EdgeDomainEndsAtVerticesHoisted (38), VertexCoincidesWithCurveEnd (37), EdgeDomainEndsAtVertices (34), SecondDerivativeMatchesCentralDifference (19), SecondDerivativeMatchesCentralDifferenceHoisted (19), ScalingScalesExtent (13), SurfaceCurveLiesOnPcurve (11), DeclaredClosedIsClosed (7), PcurveAgreesWithCurve (6), PcurveRunsWithCurve (6), SurfaceCurveLiesOnPcurveHoisted (6), VoidShellExactVolumeNegative (6), DerivativeMatchesCentralDifference (5), FaceBoundsShareNoVertex (5), PcurveAgreesWithCurveHoisted (5), VertexLinkIsOneCycle (5), VertexLinkIsOneCycleSparse (5), BSplineCurve2DDomainIsKnotSpan (4), BSplineCurve2DMatchesBasisSum (4), BSplineCurveWeightCount (4), Curve2DPlacementOrthonormal (4), Curve2DRepeatsWithPeriod (4), CurveAgreesWithPcurve (4), CurveAgreesWithPcurveHoisted (4), PcurveClosestParameterIsBounded (4), PcurveSurfaceIsAFaceSurface (4), PcurveSurfaceIsAFaceSurfaceHoisted (4), PcurveWithinSurfaceDomain (4), PcurveWithinSurfaceDomainHoisted (4), ScaledPcurvePointIsScaled (4), BSplineCurveDomainNonEmpty (3), DegenerateEdgeStaysAtStartHoisted (3), PcurveRunsWithCurveHoisted (3), RectangularTrimmedInsideBasis (3), SurfaceCurvePcurveLiesOnCurveHoisted (3), AtLeastOneBound (2), BSplineCurveDegreePositive (2), BSplineSurfaceNetConsistent (2), BSplineSurfaceWeightGridMatchesNet (2), CurvePlacementOrthonormal (2), CurveReferencesAcyclic (2), DerivativeMatchesCentralDifferenceHoisted (2), EveryEdgeUsedTwiceInClosedShell (2), PcurveDerivativeMatchesCentralDifference (2), PcurveDerivativeMatchesCentralDifferenceHoisted (2), PolyLoopHasThreePoints (2), SeamUsesRunOpposite (2), SurfaceCurveLiesOnSupport (2), SurfaceCurveLiesOnSupportHoisted (2), SurfaceCurvePcurveLiesOnCurve (2), SurfaceHasEvaluableShape (2), TrimmedRangeInsideBasis (2), BSplineCurveKnotsNonDecreasing (1), BSplineSurfaceKnotCount (1), Curve2DDerivativeMatchesCentralDifferenceHoisted (1), Curve2DSecondDerivativeMatchesCentralDifference (1), Curve2DSecondDerivativeMatchesCentralDifferenceHoisted (1), DegenerateEdgeStaysAtStart (1), EdgeUsesHaveOppositeOrientation (1), EdgeUsesHaveOppositeOrientationSparse (1), LengthToleranceResolvable (1), OpenShellVertexLinkIsCycleOrPath (1), RectangularTrimmedInsideBasisHoisted (1), SeamUsesRunOppositeSparse (1), SurfaceReferencesInRange (1), VertexLoopVertexIsIsolatedSparse (1)
Checks that pass on every file and stage: 41 of 180
