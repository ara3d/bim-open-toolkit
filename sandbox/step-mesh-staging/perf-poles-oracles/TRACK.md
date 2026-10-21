# perf-poles-oracles: the Green oracle once per face, and the curved-witness laws over meshes built once per sweep

Ticket: TKT-394
Status: merged in part: L5 (2026-10-21, the Green and volume oracles, the Green and witness laws and the pole mesh and Gauss-Bonnet laws; the six face-check laws left out, they fail on the curved witnesses and four exceed 2 s in ValidateFaceMesh, filed as a defect)

## Done
- L5, (this commit), about 1.5 h against 2 h expected. Candidate 38 of `docs/plans/step-mesher-complexity.md`.
- Types added:
  - `GreenEstimate { Ran; Coarse; Fine; FineSegments; ConeRadius }` (green-once.types.plato): the oracle's two Richardson results, the fine boundary's segment count (the allowance's rounding term), and the smallest cone radius over the coarse boundary (what `FaceAreaTolerance` read from a third boundary build). One type serves a face's areas, a face's volume terms and a shell's volumes.
  - `PoleWitness { Name; Model; Options; Whole; Euler; VolumeModel; Discretizations; FaceMeshes; Mesh }` (poles-witness.types.plato): a curved witness meshed once per sweep, round zero only, no validation, with the discretizations and face meshes so the face-check laws read the same build. `MeshedWitness` (L1) was not reused: it holds a `MeshOutcome` from `MeshModel` with Oracle validation, which the curved witnesses cannot afford compiled (L1's finding), and no face meshes.
- Functions (green-once.library.plato, block `BrepOraclesOnce`): `GreenModelOk`, `CanGreenGiven`, `GreenBoundaryCounted`, `GreenPathsOfLoopCounted`, `EdgeLoopPathBuilt`, `CoedgeUvPathBuilt`, `UnwrappedFromBuilt`, `NoGreenEstimate`, `GreenAreaPair`, `GreenAreaPairGiven`, `GreenAreaPairCounted`, `GreenAreaPairFrom`, `RawGreenAreaOf`, `GreenAreaOfRaw`, `RichardsonOf`, `Oracle_FaceAreaByGreenOnce`, `GreenAllowanceOf`, `ShellVolumePair`, `ShellVolumePairGiven`, `FaceVolumePair`, `FaceVolumePairFrom`, `FaceVolumeTermOf`, `Oracle_DivergenceVolumeOnce`, `DivergenceAllowanceOf`, `Oracle_BodyVolumeOnce`, `FaceAreaToleranceOf`, `FaceAreaToleranceOnce`, `ShellOracleAreaOnce`, `ShellOracleAreaGiven`, `TubeVolumeOnce`, `SolidVolumeWithinTubeOnce`, `IsSolidVolumeShaped`, `SolidVolumeWithinTubeGiven`, `MeshVolumeWithinTube`, `AngleDefectMatchesBrepEulerOnce`, `AngleDefectWithin`, `AngleDefectWithinCount`, `Check_FaceAreaMatchesOracleOnce`, `Check_SolidVolumeWithinTubeOnce`.
- Witnesses (poles-witness.library.plato, block `PolesWitnesses`): `PoleWitnessOf`, `PoleWitnessFrom`, and eight `Witness_*Poles`: sphere 0.05, torus 0.05, cone 0.01, torus at vertex 0.05, pole-loop sphere 0.05, redundant pole loops 0.05 (volume judged against the seamed sphere), and two face-check-only witnesses at 0.01 (sphere, pole-loop sphere), because the originals state the sphere's face checks at 0.01 and its whole-model claims at 0.05.
- Laws: `PolesWitnessLaws` (poles-witness.laws.plato): `Law_Perf_PoleMeshIsSound`, `Law_Perf_PoleGaussBonnet`, and one face-check law per witness face (`Law_Perf_SphereFaceChecksHold`, `..SphereByPoleLoops..`, `..Torus..`, `..ConeLateral..`, `..ConeBase..`, `..TorusAtVertex..`). `BrepOraclesOnceLaws` (green-once.laws.plato): the count witness `Witness_GreenAreaPairWork`, the exact count `Law_Perf_GreenAreaPairBuildsTwoBoundaries`, six agreement laws (`Law_Perf_GreenBoundaryBuiltAgrees`, `Law_Perf_GreenAreaOnceAgrees`, `Law_Perf_VolumeOnceAgrees` over the nine analytic witnesses; `Law_Perf_BSplineGreenAreaOnceAgrees`, `Law_Perf_BSplineAreaToleranceOnceAgrees` on the B-spline top; `Law_Perf_MeshReadersOnceAgree` over L1's three meshed boxes), and the fourteen Green and divergence laws restated with the witness and its estimate bound once (`Law_Perf_GreenEquals*` seven, `Law_Perf_DivergenceEqualsTorusVolume`, `Law_Perf_GreenDiskAreaWithinArcResidual`, `Law_Perf_PlanarFaceAreaMatchesGreen`, `Law_Perf_WitnessGreenAreaMatchesFacts`, `Law_Perf_WitnessDivergenceVolumeMatchesFacts`, `Law_Perf_BSplineTopAreaInBracket`, `Law_Perf_BumpTopAreaInBracket`, which states the three bumps once each instead of one case per generated Integer).
- Count witness: `Witness_GreenAreaPairWork`, slope `Evaluations(4)` per chord of the fine boundary, sizes 32 and 128 on face 0 of the unit box (4 and 16 chords per coedge). Measured: 112 at 32 and 400 at 128 (24 k + 16 at k chords per coedge: one curve evaluation and one projection per boundary point of the two polygons). Exact: 2 boundary builds (Flips) per face on every face of the nine analytic witnesses of `WitnessAt` (`Law_Perf_GreenAreaPairBuildsTwoBoundaries`). The originals built 6 for the area and its allowance and 7 for `FaceAreaTolerance` alone, more on a cone, whose nappe sign built a further coarse boundary per area.
- Verdicts: see "Verdicts" below.

## Verdicts

Baseline is reviews/verdicts-cpu64.tsv.

| Law | Baseline | Staged form, interpreted (warm server, budget 20) | Staged form, compiled (budget 2) |
|---|---|---|---|
| the 14 Green and divergence laws and `Law_BumpCurvatures` (originals, unchanged) | pass | pass, 15 of 15 | 10 pass; `Law_BSplineTopAreaInBracket` and `Law_BumpTopAreaInBracket` still running at 120 s; `Law_WitnessDivergenceVolumeMatchesFacts` 16 s, `Law_BumpCurvatures` 2.8 s, `Law_WitnessGreenAreaMatchesFacts` 2.3 s (one run shared with 30 other laws on 22 threads) |
| their 14 `Law_Perf_` forms | (pass) | pass, 14 of 14 | pass, 14 of 14, all under 2 s run alone: `BumpTopAreaInBracket` 1.50 s, `BSplineTopAreaInBracket` 1.14 s, `WitnessDivergenceVolumeMatchesFacts` 0.81 s, the rest under 0.1 s |
| agreement, exact count and slope laws (`Law_Perf_GreenBoundaryBuiltAgrees`, `..GreenAreaOnceAgrees`, `..VolumeOnceAgrees`, `..MeshReadersOnceAgree`, `..BSplineGreenAreaOnceAgrees`, `..BSplineAreaToleranceOnceAgrees`, `..GreenAreaPairBuildsTwoBoundaries`, `Law_WorkIsWithinSlope` with the new witness) | new | pass, 8 of 8 | pass, 8 of 8: 1.60 s, 1.44 s, 1.33 s, 0.96 s, 0.67 s, 0.58 s, 0.07 s, 0.03 s |
| the six `*MeshIsSound` laws -> `Law_Perf_PoleMeshIsSound` | 5 error (budget), `Law_ConeMeshIsSound` error | not run (interpreted builds of the curved witnesses exceed the warm server's budget) | pass, 8 cases, 1.27 s |
| `Law_SphereGaussBonnet` (error), `Law_TorusGaussBonnet` (error), `Law_ConeGaussBonnet` (pass) -> `Law_Perf_PoleGaussBonnet` | error, error, pass | not run | pass, 8 cases, 0.63 s |
| `Law_ConeFaceChecksHold` -> `Law_Perf_ConeLateralFaceChecksHold`, `Law_Perf_ConeBaseFaceChecksHold` | fail | not run | lateral fail (about 1 s per run alone); base pass |
| `Law_SphereFaceChecksHold`, `Law_SphereByPoleLoopsFaceChecksHold`, `Law_TorusFaceChecksHold`, `Law_TorusAtVertexFaceChecksHold` -> their `Law_Perf_` forms | error (budget) | not run | fail on each, run alone per witness: 3.25 s, 4.45 s, 61 s, 54 s; over budget (Findings) |

Final compiled lines (from `C:/Users/cdigg/git/plato`, the pinned CLI with this folder as the extra root, `--backend=csharp --profile=cpu64 --budget=2`): `--filter=BrepOraclesOnceLaws,Law_WorkIsWithinSlope` gave 21 laws, 20 pass and the B-spline agreement law at 3.17 s, which was then split into two laws; `--filter=Law_Perf_BSplineGreenAreaOnceAgrees,Law_Perf_BSplineAreaToleranceOnceAgrees,Law_Perf_PoleMeshIsSound,Law_Perf_PoleGaussBonnet` gave 4 laws, 4 pass, slowest 1.60 s; witnesses 30.8 s in total, torus 9.6 s the slowest.

## Merge instructions

07-validation/validation-oracles.library.plato (block `BrepOracles`); the staged library block moves beside it as `validation-oracles-once.library.plato`, the type as `validation-oracles-once.types.plato`:
- `Oracle_FaceAreaByGreen(m, f)` => `m.Oracle_FaceAreaByGreenOnce(f)`
- `GreenAllowance(m, f)` => `m.GreenAreaPair(f).GreenAllowanceOf`
- `CanGreen(m, f)` => `m.CanGreenGiven(f, m.GreenModelOk)`
- `GreenBoundary(m, f, n)` => `m.GreenBoundaryCounted(f, n).Value`
- `EdgeLoopPath(m, f, j, n)` => `m.EdgeLoopPathBuilt(f, j, n)`
- `CoedgeUvPath(m, site, n)` => `m.CoedgeUvPathBuilt(site, n)`
- `UnwrappedFrom(uvs, d)` => `uvs.UnwrappedFromBuilt(d)`
- `Oracle_DivergenceVolume(m, s)` => `m.Oracle_DivergenceVolumeOnce(s)`
- `DivergenceAllowance(m, s)` => `m.ShellVolumePair(s).DivergenceAllowanceOf`
- `Oracle_BodyVolume(m, b)` => `m.Oracle_BodyVolumeOnce(b)`
- `FaceAreaTolerance(m, f, c)` => `m.FaceAreaToleranceOnce(f, c)`
- `GreenArea`, `RawGreenArea`, `FaceNappeSign`, `ShellVolume`, `FaceVolumeTerm`, `FaceSmallestConeRadius` stay (validation.spec.plato line 428 names `GreenArea`; `FaceCurvatureBound` reads `FaceSmallestConeRadius`); after the wiring above nothing on the hot path calls them.

07-validation/validation-checks-cross.library.plato:
- `TubeVolume(m, b, c)` => `m.TubeVolumeOnce(b, c)`
- `ShellOracleArea(m, s)` => `m.ShellOracleAreaOnce(s)`
- `Check_FaceAreaMatchesOracle(m, mesh, c)` => `m.Check_FaceAreaMatchesOracleOnce(mesh, c)`
- `Check_SolidVolumeWithinTube(m, mesh, c)` => `m.Check_SolidVolumeWithinTubeOnce(mesh, c)`

07-validation/validation.laws.plato (block `BrepCheckingLaws`):
- `AngleDefectMatchesBrepEuler(m, mesh, s)` => `m.AngleDefectMatchesBrepEulerOnce(mesh, s)`
- `SolidVolumeWithinTube(m, mesh, c, b)` => `m.SolidVolumeWithinTubeOnce(mesh, c, b)`
- Replace the bodies of `Law_GreenEqualsCylinderPatchArea`, `..CylinderSectorPatchArea`, `..SphereArea`, `..SphereAreaByPoleLoops`, `..TorusArea`, `..ConePatchArea`, `..BoxFaceArea`, `Law_DivergenceEqualsTorusVolume`, `Law_GreenDiskAreaWithinArcResidual`, `Law_PlanarFaceAreaMatchesGreen` with the staged `Law_Perf_` bodies, and move the helpers `GreenAreaWithin`, `GreenEstimateWithin`, `DivergenceEstimateWithin`, `PlanarAreaMatchesGreen`, `GreenMatchesWhereFinite` with them.

07-validation/validation-witnesses.laws.plato (block `BrepWitnessesLaws`): the bodies of `Law_WitnessGreenAreaMatchesFacts`, `Law_WitnessDivergenceVolumeMatchesFacts`, `Law_BSplineTopAreaInBracket` from their `Law_Perf_` forms, with `WitnessGreenAreaMatches`, `WitnessDivergenceVolumeMatches`, `DivergenceMatchesWhereFinite`, `IsInBumpBracket`.
07-validation/bspline-oracles.laws.plato: `Law_BumpTopAreaInBracket` needs no change once `Law_BSplineTopAreaInBracket` has the staged body; delete `Law_Perf_BumpTopAreaInBracket`.

07-validation/poles.laws.plato: move the type and the two staged blocks in as `poles-witness.{types,library,laws}.plato` (the poles laws already read layer 08's `DefaultMeshingOptions`, so the witness sits where its laws do); rename `Law_Perf_PoleMeshIsSound` to `Law_PoleMeshIsSound`, `Law_Perf_PoleGaussBonnet` to `Law_PoleGaussBonnet`, and delete `Law_SphereMeshIsSound`, `Law_SphereByPoleLoopsMeshIsSound`, `Law_TorusMeshIsSound`, `Law_ConeMeshIsSound`, `Law_TorusAtVertexMeshIsSound`, `Law_RedundantPoleLoopsMeshIsSound`, `Law_SphereGaussBonnet`, `Law_TorusGaussBonnet`, `Law_ConeGaussBonnet`, and `MeshIsSound`, `GaussBonnetHolds`. The five `*FaceChecksHold` laws: see Findings before wiring; they replace the originals one for one (`Law_ConeFaceChecksHold` becomes the lateral and base laws), and `FaceCheckFailures` has no caller after.

After wiring, the six agreement laws compare each replacement with itself: delete them, or keep them only for the merge check run.

## Contract requests
- none: every type and function is an addition.

## Requests to other tracks
- The V-series owner of `ValidateFaceMesh` (layer 07 face-mesh reports): the face checks take 2.25 s (cone, two faces), 3.25 s (sphere at 0.01), 4.45 s (pole-loop sphere at 0.01), 54 s (torus at a vertex) and 61 s (torus) compiled per witness face, on meshes already built. The face-check laws cannot meet the 2 s budget until that report is cheaper. Not blocking the rest of this chunk.

## Findings
- The six whole-model witnesses and the two face-check witnesses build in 2.6 s to 16.2 s compiled each (torus at vertex 16.2 s, torus 13.1 s, the rest under 5 s), so none is left out. Round zero without validation is what makes them cheap: F3 measured 19 s to 122 s for the refined meshes.
- The face-check laws fail on every curved witness, not only the cone: sphere at 0.01, pole-loop sphere at 0.01, torus, torus at a vertex, and the cone (whose baseline was already fail). The originals never finished inside the budget, so the baseline recorded errors and hid the failures. Which checks fail was not found: the runner shrinks a failing witness's strings, so a probe that returns the names prints them scrambled. A follow-up should state one law per check name.
- Gauss-Bonnet holds on both pole-loop spheres and fails on the torus pinned at a vertex (2.0, 0.5) at 0.05. The originals never stated it there; the staged law keeps their three witnesses (`StatesGaussBonnet`) and the torus-at-vertex failure is a lead for layer 05 or 06 (a vertex of the pinned torus whose angle sum does not match the B-rep's Euler characteristic of 0).
- `Law_ConeMeshIsSound`, `Law_SphereMeshIsSound`, `Law_TorusMeshIsSound` and the other `MeshIsSound` laws, budget errors in the baseline, pass compiled: the mesh claims hold on all six witnesses.
- Results are bit-identical: every replacement equals its original on every face, shell and body of the nine analytic witnesses and the B-spline top (`Law_Perf_GreenAreaOnceAgrees`, `Law_Perf_VolumeOnceAgrees`, `Law_Perf_GreenBoundaryBuiltAgrees`, the two B-spline laws) and on the three meshed box witnesses (`Law_Perf_MeshReadersOnceAgree`). The cone's nappe sign is read from the coarse boundary, the same boundary `FaceNappeSign` built.
- `GreenAreaPairCounted` at n other than `GreenChords` reads the nappe sign from its own n-chord boundary, where the original always read it at `GreenChords`; only the count witness calls it at other n, on a planar face.
- `DivergenceAllowance` counted the fine boundary of a face the oracle cannot run on; `ShellVolumePair` counts 0 for it. The allowance is NaN in both, since the volume is.
- The original B-spline top laws (`Law_BSplineTopAreaInBracket`, `Law_BumpTopAreaInBracket`) do not finish in 120 s compiled: each rebuilt the witness 4 times and the top's quadrature boundary about 10 times per case. The staged forms take 1.1 s and 1.5 s. `AreaSegmentByQuadrature` remains the cost of a B-spline face (about 0.7 s compiled for one pair of boundaries).
- Not done: the face-check laws are staged but fail on every curved witness, and four of them exceed 2 s compiled inside `ValidateFaceMesh` on a mesh already built (outside this fence). Wire them only after the face-mesh report chunk; until then the originals' budget errors stand.
- The plan's row names `BrepValidationLaws` for `AngleDefectMatchesBrepEuler` and the Green laws; they are in `BrepCheckingLaws` (V2 met the same).
- The thirteen "twice-computed" laws are not listed in the plan; this chunk took them to be the laws the dispatch names (the Green and divergence laws, the witness-facts laws, the B-spline top) plus `Law_ConeFaceChecksHold`'s two `DiscretizeAll`, which the witness removes.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, ticket, L1 track, oracles, poles laws, checks) | 20 min | |
| Writing | 25 min | |
| Interpreted runs | 5 min | warm server 2 runs (the staged block 19 pass, 1 skip; the 15 originals pass); pinned CLI interpreter 2 runs (one parse failure: a local named `out`) |
| Compiled runs | 18 min | 8 single-witness runs (about 50 s each, two of them 2 min for the torus face checks); 1 probe run; final run below |
| Final compiled runs | 4 min | 1 combined run of 43 laws (211 s; times inflated by 22 threads, so used only for verdicts), then 2 isolated runs (68 s, 73 s) |

## Lessons
- A local named `out` made the whole file fail with "Parsing failed" and no line, and the warm server reported "0 laws"; renaming it fixed the parse (most likely a reserved word).
- Run the compiled budget check per group, not all at once: 43 laws on 22 threads inflated a 0.1 s law to 110 s.
- Measure each new witness alone on the compiled backend (one staging copy per witness): the runner prints a witness's time only when every witness has been built.
