# v1-proof: the host meshes through layer 8's own refinement step and one definition of its options

Ticket: TKT-454, TKT-436
Status: ready: P6

## Done
- P6, this commit, about 2.5 h against 2 h expected.
  - `refine-min-length.library.plato` (library `V1ProofRefine`): `WithRequestedChordal(c, chordal)` lowers `MinLength`
    by the factor the chordal bound falls (a zero request keeps it), and `RefineIndexedCountedScaled` is layer 4's
    `RefineIndexedCounted` using it (TKT-454).
  - `host-options.library.plato` (library `V1ProofHostOptions`): `HostMeshingOptions(chordal)` (layer 8's defaults with
    quads), `WithQuads`, `WithLevel`, `WithRoundLimit`; `BlockingRequests`, `BlockingStateOf(d, outcomes, chosen)`,
    `StepAnsweringBlocking` (layer 8's `Step` with only blocking requests left pending) and
    `FinalStateAnsweringBlocking`; layer 8's `Step` in parts (`StepRefined`, `StepRemeshed`, `StepNext`,
    `StepByParts`, `BlockingOnly`) so the host meshes the remeshed faces on every core through the per-face function
    Step uses (supervisor decision 3); one replacement per copy of the host's options (TKT-436).
  - Laws, against a `git archive` of bim-open-toolkit 4bc98ded (`--library`; the working tree had a merge in
    progress): `V1ProofRefineLaws` 4 pass (`RequestedChordalKeepsFloorRatio` 25 cases, `ZeroRequestKeepsFloor` 25,
    `RefineScaledKeepsUnrequestedEdges` 224 exhaustive, `RefineScaledSplitsWhereRefineCannot`: on the cylinder with a
    floor longer than the circle, Refine changes no requested edge and RefineScaled splits the curved ones);
    `V1ProofHostOptionsLaws` 4 pass (`HostOptionsAreDefaultsWithQuads`, `ReplacementsAgree` 14 exhaustive, each
    replacement equal to the copy it replaces, and `V1GateOptions` to the host's with quads;
    `WithChangesOneField`; `StepAnsweringBlockingLeavesOnlyBlocking` on the cylinder; `StepByPartsIsStep`: on the
    cylinder with every edge asked for half its bound and twice its segments, Step and StepByParts give the same
    round, discretizations, face meshes and pending count), 1 fail by design:
    `Law_V1Proof_WitnessOptionsMeshLikeTheHost` (TKT-436 criterion 2) fails until the merge gives `WitnessOptions` the
    host's options; see the second merge instruction group. 0 type errors.
  - End to end, before the merge: a scratch git repository of 4bc98ded with the first merge group applied (WithRounds
    moved, the laws file's copy deleted), regenerated with `regen-step-brep.ps1 -LibraryRoot` (0 degraded, 1,432
    files), and a scratch bim-open-data with `host-after-merge.patch` applied, harness `time --path host --parallel
    --warmup`, Release:

    | File | Faces meshed | Boundary edges | Refine ms: P6 parts, every core | P6 with Step, in sequence | P4 C# loop | Digest, all three |
    |---|---|---|---|---|---|---|
    | POS/CAM | 1,306 / 1,306 | 13 | 22 | 21 | 19 | F9E768CF6493BA43 |
    | POS/ANN-MB2 | 2,088 / 2,088 | 0, closed | 719 | 1,632 | 606 | 9DFC46DC4EDB8995 |
    | SHO/EMMY-W1 | 399 / 399 | 0, closed | 0 | 0 | 0 | 1B97BDCE29D17629 |
    | SHO/NINA-B400 | 913 / 913 | 0, closed | 0 | 0 | 0 | D03B89055346EDD1 |
    | SHO/ODIN-W160 | 3,552 / 3,552 | 0, closed | 1 | 1 | 2 | 1A53CE58BD122D78 |
    | SHO/LILY-W131 | 960 / 960 | 0, closed | 0 | 0 | 0 | 7332CEA3C0D61A04 |

    The P4 numbers (faces meshed, closed and oriented, boundary counts) hold. The digests are the same under all three
    loops on the same regenerated library, so P6 changes no mesh; they differ from P4's recorded digests because the
    library at 4bc98ded is newer than bim-open-data's committed generation (a control regeneration of 4bc98ded with no
    P6 change gives the same new digests). The scratch `PlatoRefinementTests`, Release, STEP_CORPUS set: 5 of 5 pass,
    among them `HostLoopIsLayer8Loop` on CAM and ANN-MB2: the host's loop (parts, every core) ends at the same round,
    discretizations, face meshes and pending count as layer 8's `FinalStateAnsweringBlocking` (Step in sequence).

## Merge instructions

First group (TKT-454 and the host's loop):
- Move `refine-min-length.library.plato` into `04-discretization/` and `host-options.library.plato` into `08-pipeline/`
  (laws files beside them).
- `RefineIndexedCounted` (04-discretization/discretization-refine-indexed.library.plato):
  `c.WithChordal(ix.RequestedChordalIn(old.Edge, c.Chordal))` => `c.WithRequestedChordal(ix.RequestedChordalIn(old.Edge, c.Chordal))`;
  then delete `RefineIndexedCountedScaled` and `RefineScaled`, and point the two laws that call `RefineScaled` at `Refine`.
- `BsplinePipelineLaws.WithRounds` (bspline-pipeline.laws.plato): delete it and rename `WithRoundLimit` to `WithRounds`
  everywhere in the staged files (identical bodies; the staging name avoids the collision). The patch uses `WithRounds`.
- Layer 8's `Step` body => `m.StepByParts(o, chosen, s)` (Law_V1Proof_StepByPartsIsStep holds before the change).
- Then regenerate, and apply `host-after-merge.patch` in deps/bim-open-data (v1-proof does it on request): the host
  calls `HostMeshingOptions`, `BlockingStateOf`, `StepRefined`, `StepRemeshed`, `FaceOutcomeInRange` (every core),
  `StepNext` and `BlockingOnly`; `Blocking`, `RefineCriteria`, `Criteria`,
  `MaxRefinementRounds`, `PreferQuads` and `SurfaceAngleDegrees` go from C#; `StepMeshingOptions.ChordalMillimetres`
  is the one metres-to-millimetres conversion (StepMesher, the harness, the refinement test).

Second group (TKT-436, the five copies; `ReplacementsAgree` shows each changes no law's cases):
- `PolesLaws.PolesOptionsAt(chordal, quads)` => `PolesOptionsAtHost(chordal, quads)`
- `GridChordalLaws.GridCaseCriteria(_)` => `GridCaseCriteriaHost(_)`
- `PipelineProofsMesh...CatalogQuadCriteria(c)` => `CatalogQuadCriteriaHost(c)`
- `FaceMeshingLiftIndexedLaws.LiftCaseCriteria(quads)` => `LiftCaseCriteriaHost(quads)`
- `StructuralWitnessOptions(_)`: keep one (pipeline-run.laws.plato) => `StructuralWitnessOptionsHost(_)`, delete the
  copy in 09-tooling/tooling-law-runner.laws.plato.
- Deferred (supervisor decision 2: after the corpus run, its own chunk with a full sweep against the baseline):
  `WitnessOptions(_)` => `HostMeshingOptions(0.01).WithLevel(ConformanceLevel.Oracle)` makes
  the witness laws mesh with quads as the host does (TKT-436 criterion 2, the TKT-415 lesson) and turns
  `Law_V1Proof_WitnessOptionsMeshLikeTheHost` green, but changes the cases of every witness law; its effect on them
  is not measured here.

## Contract requests
- none: every change is an addition or a body; no type changes.

## Findings
- Layer 4's Refine kept the length floor when a face asked for a smaller chordal bound (TKT-454): at the host's 1 mm
  bound no segment under 0.2 mm ever split (CAM face 124 stayed not simple through every round).
- Lowering the floor for the whole step, rather than inside Refine, also reaches MeshFace, whose interior refinement
  then runs for over 10 minutes on one ANN-MB2 round (P4 trace): the floor belongs to the requested edges only.
- A local named `a`, `b` or `all` in a law stopped the compile with "Circular expression"; descriptive names fixed
  it (the resolver seems to confuse a short local with a function of the same name in another case).
- `MeshingOptions` and `DecodePolicy` have no equality; the type checker rejects `==` on them although the
  interpreter evaluates it. `SameOptions` in the laws compares the fields that have one.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading layers 4 and 8 and the five copies | 20 min | |
| Staged library and laws | 40 min | 7 law runs (server busy with a merge: 2 runs lost to it) |
| Scratch merge, regeneration and harness, with the C# patch | 15 min | 1 regeneration (2.5 min), 2 builds |
| Six files, P6 and the HEAD-only control | 10 min | 12 timed runs, 1 regeneration (3.5 min) |
| TRACK.md, ticket, commit | 15 min | |
| Decisions 1 and 3: Step in parts, law, host patch, second scratch regeneration, tests and six files | 35 min | 3 law runs, 1 regeneration (3.8 min), 2 builds, 5 tests (3.4 min), 6 timed runs |

## Lessons
- With the library's working tree mid-merge, `plato_laws.py --library <git archive of HEAD>` gave clean runs at once.
- A control regeneration of HEAD without the change was what separated "the change moved the digests" from "the
  library moved them"; without it the new digests would have read as a regression.
