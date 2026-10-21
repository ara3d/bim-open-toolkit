# perf-masks: face masks for shell restriction, volumes about a bound origin (chunk M3)

Ticket: TKT-368
Status: ready: M3

## Done
- M3, this commit, about 1 h against 2 h. Candidates 11 and layer 07 #8 of `docs/plans/step-mesher-complexity.md`.
  - Layer 06 (`mesh-masks.library.plato`, library `ModelMeshMasks`): `FaceMask(faces, faceCount)`, `FaceSpan(mesh)`, `ElementsOfFaceMaskCounted(mesh, mask, faces)`, `ElementsOfFaceMask`, `ElementsOfFacesMasked(mesh, faces)`, `RestrictedToElements(mesh, kept)` (the body of `RestrictedToFaces`, unchanged), `RestrictedToFacesByMask(mesh, mask, faces)`, `RestrictedToFacesCounted(mesh, faces)`, `FacesWithElements(mesh, faceCount)`, `SignedVolumeAbout(mesh, o)`, `VolumeRoundingMagnitudeAbout(mesh, o)`, `SignedVolumeAbout(mesh, comps, c, o)`, `RestrictedVolumeCounted(mesh, faces)`.
  - Layer 07 (`validation-checks-masks.library.plato`, library `BrepCrossCheckingMasks`): `RestrictedToShellByMask(m, mesh, s)`, `IsCompleteShellMeshGiven(m, mesh, s, withElements)`, `ShellMeshEulerByCounts(m, mesh, s)`, `VolumeRoundoffAbout(mesh, o)`, `ShellMeshVolumeAbout(m, mesh, s, o)`.
  - Types added: `MaskMeshWitness` (name, model, mesh), a meshed model shared per sweep until chunk L1's `MeshedWitness` merges. No other type: a face mask is an `Array<Boolean>` indexed by face, read in two places, and a wrapper would add a name without a rule.
  - Results identical, bit for bit: the same elements in the same order, the same volume terms summed in the same order about the same origin. Shown by ten `Law_Perf_*` laws over generated meshes (25 cases each) and over the unit box and the hollow box meshed once per sweep (`Witness_UnitBoxMasks`, `Witness_HollowBoxMasks`).
  - Interpreter (cpu64, budget 20): `ModelMeshMasksLaws,BrepCrossCheckingMasksLaws,MaskWitnessLaws,Law_WorkIsWithinSlope`: 12 laws, 12 pass. The laws the chunk must keep: `ModelMeshesLaws` and `ModelMeshMeasuresLaws` (all 17 pass, including `Law_RestrictionKeepsTheElementsOfTheFaces`, `Law_RestrictionKeepsEachCorner`, `Law_RestrictionKeepsEachElementFace`, `Law_RestrictionToEveryFaceKeepsTheEulerCharacteristic`, `Law_ReversalNegatesSignedVolume`, `Law_OutwardTetrahedronHasPositiveVolume`), `StepToMeshWitnessesLaws.Law_HollowBox{VoidMeshVolumeNegative,OuterMeshVolumePositive,MeshVolumeIsDifference}`, `Law_UnitBoxMeshesAsStated`, `StepToMeshLaws.Law_ValidationIsIdempotent`: 22 laws, 22 pass, as in `reviews/verdicts-cpu64.tsv`. The `StepToMeshLaws` shell laws (`Law_MeshEulerEqualsBrepEuler`, `Law_MeshClosedExactlyWhenShellClosed`, `Law_OuterShellVolumePositive`, `Law_VoidShellVolumeNegative`, `Law_ShellReversalNegatesVolume`) and the `PolesLaws` `*MeshIsSound` laws are `error` (time budget, in meshing) in the tsv; not rerun, since nothing they call changes before wiring and their time goes into meshing.
  - Compiled, from `C:/Users/cdigg/git/plato`: `dotnet C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll run stdlib/foundation stdlib/geometry stdlib/graphics C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-mesh-staging/perf-masks --recursive --exclude=brep.types.plato --exclude=brep.library.plato --exclude=brep.concepts.plato --laws --backend=csharp --profile=cpu64 --budget=2 --filter=ModelMeshMasksLaws,BrepCrossCheckingMasksLaws,MaskWitnessLaws,Law_WorkIsWithinSlope,ModelMeshesLaws,ModelMeshMeasuresLaws`: 29 laws, 29 pass; slowest `Law_WorkIsWithinSlope` 0.08 s over 9 cases; witnesses `Witness_HollowBoxMasks` 7.1 s and `Witness_UnitBoxMasks` 3.1 s, once per sweep; total 54.9 s. The one degraded body is in the library (perf-assembly placed it). `Law_Perf_ShellMeshEulerByCountsAgrees` was then pointed at `RestrictedToShell(...).ReferencedEulerCharacteristic` (so it still compares two routes after wiring) and rerun on the interpreter only.
  - Count witnesses (`mesh-masks.laws.plato`), Insertions, on closed fans of k = 16 and 128 triangles with two triangles per face, restricted to half the faces:
    - `Witness_RestrictedToFacesWork`: mask entries cleared and marked plus element-face comparisons, slope `Insertions(2)` per unit of T + F, sizes 24 and 192. Measured 28 and 224 (1.75k) against allowances 48 and 384. The reference compares k^2 / 4 pairs: 4,096 at k = 128.
    - `Witness_RestrictedVolumeWork`: positions read for the origin (computed once), the restriction, one term per kept element, slope `Insertions(2)` per unit of T + F + V, sizes 41 and 321. Measured 53 and 417 (3.25k + 1) against 82 and 642. The reference reads every position once per element: k (k + 1) reads.

## Merge instructions
- Move `mesh-masks.library.plato` and `mesh-masks.laws.plato` to `06-mesh/`; `validation-checks-masks.library.plato` and `validation-checks-masks.laws.plato` to `07-validation/`; `masks-witnesses.types.plato` and `masks-witnesses.laws.plato` to `08-pipeline/` (they mesh BrepModel witnesses). Once L1 has merged, replace `MaskMeshWitness` by `MeshedWitness` and read `w.Outcome.Mesh`.
- `06-mesh/mesh.library.plato` `ElementsOfFaces(mesh, faces)` => `mesh.ElementsOfFacesMasked(faces)`.
- `RestrictedToFaces(mesh, faces)` => `mesh.RestrictedToFacesCounted(faces).Value` (delete the old body; `RestrictedToElements` holds it).
- Keep `IsElementOfFaces` (one element, O(faces)); after the wiring nothing in the library calls it, so delete it if no law needs it.
- `06-mesh/mesh-measures.library.plato` `SignedVolume(mesh)` => `mesh.SignedVolumeAbout(mesh.VolumeOrigin)`.
- `VolumeRoundingMagnitude(mesh)` => `mesh.VolumeRoundingMagnitudeAbout(mesh.VolumeOrigin)`.
- `SignedVolume(mesh, comps, c)` => `mesh.SignedVolumeAbout(comps, c, mesh.VolumeOrigin)`.
- `07-validation/validation-checks-cross.library.plato` `RestrictedToShell(m, mesh, s)` => `m.RestrictedToShellByMask(mesh, s)`.
- `IsCompleteShellMesh(m, mesh, s)` => `m.IsCompleteShellMeshGiven(mesh, s, mesh.FacesWithElements(m.Faces.Count))`.
- `ShellMeshEuler(m, mesh, s)` => `m.ShellMeshEulerByCounts(mesh, s)`.
- `ShellMeshVolume(m, mesh, s)` => `mesh.RestrictedVolumeCounted(m.ShellFaces(s)).Value`.
- `VolumeRoundoff(mesh)` => `mesh.VolumeRoundoffAbout(mesh.VolumeOrigin)`.
- Optional: `BodyMeshVolume` binds `var o = mesh.VolumeOrigin;` once and sums `m.ShellMeshVolumeAbout(mesh, s, o)`: one origin per body, not per shell.
- After wiring, these laws would compare a function with itself; delete them: `Law_Perf_ElementsOfFacesMaskedAgrees`, `Law_Perf_RestrictedToFacesCountedAgrees`, `Law_Perf_VolumeAboutAgrees`, `Law_Perf_VolumeRoundoffAboutAgrees`, `Law_Perf_RestrictedToShellByMaskAgrees`, `Law_Perf_ElementsOfFacesMaskedAgreesOnShells`, `Law_Perf_ShellVolumesAboutAgree`. Keep and rename to `Law_*`: `Law_Perf_FacesWithElementsAgrees` (`HasMeshElements` is not rewired), `Law_Perf_IsCompleteShellMeshGivenAgrees` (its face half still compares two routes), `Law_Perf_ShellMeshEulerByCountsAgrees` (compares with the components route), `Law_Perf_MaskWitnessIsComplete`. Run the agreement laws once before wiring, the kept ones after.

## Contract requests
- none

## Requests to other tracks
- V-chunks (V2, V6 or whichever hoists the cross checks per report): `EveryFaceIsMeshed` calls `HasMeshElements` once per face, O(T) each, O(F T) per report. Hoist one `mesh.FacesWithElements(m.Faces.Count)` per report and read it per face. Not blocking.

## Findings
- `RestrictedToFaces` keeps an element whose `ElementFace` is negative when `faces` names the same negative index: the reference compares raw values. A mask cannot hold a negative index, so `ElementsOfFaceMaskCounted` falls back to the reference comparison for an element whose face lies outside the mask. No assembled mesh has such an element, so the fallback costs nothing there; it keeps the results identical on every generated mesh. Whether a negative element face should ever match is a question for the ModelMesh invariants (`IsWellFormed` does not forbid it).
- On the compiled backend, a `Witness_*` value referenced from inside a function (`MaskMeshWitness.Witness_UnitBoxMasks` in a count witness's `WorkAt`) is rebuilt on each reference, not shared. The first draft took its count witnesses from the two meshed boxes: `Law_WorkIsWithinSlope` took 21.7 s compiled, and building the `WorkClaim` took 13.6 s. Literal fans fixed it (0.08 s). M1's `NumberingWorkAt` uses the same pattern; it is cheap there only because the boxes are small.
- `ShellMeshEuler` built the components of the restriction only to count its unreferenced vertices; `ReferencedVertexCount` (layer 07 oracles) counts the same vertices from the corners in one pass. `ShellMeshEulerByCounts` uses it.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, ticket, layers 06 to 08, M1 and M2 tracks, primer) | 15 min | |
| Writing | 20 min | |
| Law runs, interpreter | 4 min | 6 runs, two with a scratch probe folder for the measured work |
| Compiled runs | 3 min | 2 runs (91 s with the box count witnesses, 55 s with the fans) |
| Waiting | 1 min | |

## Lessons
- Bash heredocs with apostrophes in the body failed in this tool environment; writing the files with the editor avoided it.
- Build count witnesses from literal meshes, never from meshed `Witness_*` values: the compiled backend does not share a witness referenced inside a function.
