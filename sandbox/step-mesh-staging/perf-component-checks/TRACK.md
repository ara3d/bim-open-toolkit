# perf-component-checks: the component checks of layer 7 over tables built once per report (chunk V6)

Ticket: TKT-374
Status: merged: V6 (2026-10-21, into 06-mesh/mesh-components-given.{types,library}.plato, 07-validation/validation-checks-components.library.plato, validation-components.laws.plato; the meshed comparison file deleted after wiring)

## Done
- V6, (this commit), about 0.8 h against 2 h expected. Added:
  - Types (`mesh-components-given.types.plato`): `ComponentRootTables` (the lowest element of each component and the running root count, one pass), `MeshComponentTables` (incidence, components, edge table, per-component counts, root tables, `IsWellFormed`, `HasAllValidCorners`, each built once).
  - Layer 06 (`mesh-components-given.library.plato`, library `ModelMeshComponentsGiven`): `ComponentRootTablesCounted`/`Of`, `RootsBelowAt`, `NoElementBelowIn`, `MeshComponentTablesCounted`/`Of`; one `<Law>Given` per law, the law's expression with the rebuilt table replaced by a parameter: `ComponentParentIsInItsComponentGiven`, `ComponentParentSharesAVertexGiven`, `ComponentRootHasDepthZeroGiven`, `ComponentParentIsOneShallowerGiven`, `ComponentRootIsItsLowestElementGiven` (the pair law), `ComponentRootIsLowestGiven` (the row of the pair law, constant time), `ComponentCountIsRootCountGiven`, `ComponentsAreNumberedByRootGiven`, `ClosedMeshHasNoPinchedVertexGiven`, `CountsIn`, `ClosedOrientedSurfaceHasGenusGiven`, `OrientedSurfaceWithBoundaryHasGenusGiven`, `AngleDefectSumIsTwoPiTimesEulerGiven`, `AngleDefectSumIsTwoPiTimesEulerPlusQuadDefectsGiven`, `VerticesOfOneComponentAreApartGiven`. They are named `...Given`, not `Law_...` overloads, because the runner runs every `Law_` function and would feed these random, inconsistent tables (V2 took the same route).
  - Layer 07 (`validation-checks-components.library.plato`, library `BrepCheckingComponents`): the `*WithComponents` per-element checks, `Check_ComponentRootIsItsLowestElementLinear`, `Check_ClosedMeshHasNoPinchedVertexGiven`/`Hoisted`/`WithTables`, the `*WithTables` per-component checks, `Check_VerticesOfOneComponentAreApartWithComponents` (pairs bound once), `CheckComponentsGiven`, `ModelMeshStructureReportCounted` and `ModelMeshStructureReport` (ModelMeshReport's Structure family, same 29 checks, order and messages).
  - Laws (`component-checks-given.laws.plato`, `ComponentChecksGivenLaws`): 7 `Law_Perf_*` and `Witness_ComponentChecksWork`; (`component-checks-meshed.laws.plato`, `ComponentChecksMeshedLaws`): `Law_Perf_MeshedStructureReportAgrees` over the three `MeshedWitness` values.
- Interpreter (cpu64, budget 20): `ComponentChecksGivenLaws`, `ComponentChecksMeshedLaws`, `Law_WorkIsWithinSlope`: 9 laws, 9 pass (the agreement laws on IncidenceTestMeshAt's 6 meshes, on 25 runner meshes, on 25 runner component tables, on the misrooted table, and on the unit box, block with a through hole and hollow box meshes). Kept laws against `reviews/verdicts-cpu64.tsv` (`--baseline`, no change reported): `ModelMeshTopologyLaws`, `ModelMeshMeasuresLaws`, `ModelMeshIncidenceLaws`, `BrepCheckingLaws`, `Law_WitnessMeshValidatesClean`, `Law_MeshedMeshValidatesStructurally`: 89 laws, 82 pass, 6 skipped (function-typed parameters), 1 error: `StepToMeshLaws.Law_MeshedMeshValidatesStructurally` on time at case 7 (meshing the torus), as in the baseline. `Law_WitnessMeshValidatesClean` now runs as `StepToMeshMeshedWitnessesLaws.Law_WitnessMeshValidatesClean` (chunk L1) and passes on 3 witnesses; the tsv's `StepToMeshWitnessesLaws` row (error on time) predates L1.
- Compiled (`--backend=csharp --profile=cpu64 --budget=2 --abandon=20`, filter `ComponentChecksGivenLaws,ComponentChecksMeshedLaws,Law_WorkIsWithinSlope`): 9 laws, 9 pass; slowest `Law_WorkIsWithinSlope` 0.45 s over 26 cases, `Law_Perf_MeshedStructureReportAgrees` 0.35 s over 3 cases (the library's report on the meshed witnesses included); the three MeshedWitness builds 23.4 s, once per sweep.
- Count witness: `Witness_ComponentChecksWork`, slope `Insertions(8).Add(Flips(1))`, Size the element count, on IncidenceTestFan(6) (IncidenceTestMeshAt's fan) and IncidenceTestFan(64). Flips counts ComponentsOf builds; Insertions counts the element visits of the component checks (the root tables' pass and the six per-element component checks). Measured: Insertions 42 and 448 (7 per element), Flips 1 at both sizes. The exact claim, one ComponentsOf build per report, is asserted on every agreement case (`StructureReportAgreesOn`).

## Merge instructions
- Move `mesh-components-given.types.plato` and `mesh-components-given.library.plato` to `06-mesh/`, `validation-checks-components.library.plato` to `07-validation/`.
- 06 mesh-topology.laws.plato, each law delegating to its Given form:
  - `Law_ClosedMeshHasNoPinchedVertex(mesh, v) => mesh.ClosedMeshHasNoPinchedVertexGiven(mesh.IsClosed, mesh.VertexElementIncidence, v)` (or keep the reference form: the incidence costs O(V + T) per call; per law case the two costs are alike)
  - `Law_ComponentParentIsInItsComponent(mesh, e) => mesh.ComponentParentIsInItsComponentGiven(mesh.ComponentsOf, e)`
  - `Law_ComponentParentSharesAVertex(mesh, e) => mesh.ComponentParentSharesAVertexGiven(mesh.ComponentsOf, e)`
  - `Law_ComponentRootHasDepthZero(mesh, e) => mesh.ComponentRootHasDepthZeroGiven(mesh.ComponentsOf, e)`
  - `Law_ComponentParentIsOneShallower(mesh, e) => mesh.ComponentParentIsOneShallowerGiven(mesh.ComponentsOf, e)`
  - `Law_ComponentRootIsItsLowestElement(mesh, r, e) => mesh.ComponentRootIsItsLowestElementGiven(mesh.ComponentsOf, r, e)`
  - `Law_ComponentsAreNumberedByRoot(mesh, r)`: keep its body with `mesh.ComponentsOf` bound once, `{ var comps = mesh.ComponentsOf; return (mesh.IsElementInRange(r) ? comps.IsComponentRoot(r) : false) ? comps.ElementComponentOf(r).Value == comps.RootsBelow(r) : true; }` (the Given form needs root tables, which a single case does not repay)
  - `Law_ComponentCountIsRootCount(mesh) => mesh.ComponentsOf.ComponentCountIsRootCountGiven`
  - `Law_ClosedOrientedSurfaceHasGenus(mesh, c) => mesh.CountsOf(c).ClosedOrientedSurfaceHasGenusGiven(mesh.IsWellFormed)` (CountsOf is total, so evaluating it on a malformed mesh changes no verdict)
  - `Law_OrientedSurfaceWithBoundaryHasGenus(mesh, c) => mesh.CountsOf(c).OrientedSurfaceWithBoundaryHasGenusGiven`
- 06 mesh-measures.laws.plato:
  - `Law_AngleDefectSumIsTwoPiTimesEuler(mesh, c) => mesh.AngleDefectSumIsTwoPiTimesEulerGiven(mesh.ComponentsOf, mesh.CountsOf(c), mesh.HasAllValidCorners, c)`
  - `Law_AngleDefectSumIsTwoPiTimesEulerPlusQuadDefects(mesh, c) => mesh.AngleDefectSumIsTwoPiTimesEulerPlusQuadDefectsGiven(mesh.ComponentsOf, mesh.CountsOf(c), mesh.HasAllValidCorners, c)`
  - `VerticesOfOneComponentAreApart(mesh, a, b, tol) => mesh.VerticesOfOneComponentAreApartGiven(mesh.ComponentsOf, a, b, tol)`
- 07 validation-checks-mesh.library.plato:
  - `Check_ClosedMeshHasNoPinchedVertex(mesh) => mesh.Check_ClosedMeshHasNoPinchedVertexHoisted`
  - `Check_ComponentParentIsInItsComponent(mesh) => mesh.Check_ComponentParentIsInItsComponentWithComponents(mesh.ComponentsOf)`, and the same for `ComponentParentIsOneShallower`, `ComponentParentSharesAVertex`, `ComponentRootHasDepthZero`, `ComponentCountIsRootCount`
  - `Check_ComponentsAreNumberedByRoot(mesh)`: bind `var comps = mesh.ComponentsOf; return mesh.Check_ComponentsAreNumberedByRootWithComponents(comps, mesh.ComponentRootTablesOf(comps));` and the same for `Check_ComponentRootIsItsLowestElement` => `Check_ComponentRootIsItsLowestElementLinear(comps, mesh.ComponentRootTablesOf(comps))`
  - `Check_ClosedOrientedSurfaceHasGenus(mesh) => mesh.Check_ClosedOrientedSurfaceHasGenusWithTables(mesh.MeshComponentTablesOf)`, and the same for `OrientedSurfaceWithBoundaryHasGenus`, `AngleDefectSumIsTwoPiTimesEuler`, `AngleDefectSumIsTwoPiTimesEulerPlusQuadDefects`
  - `Check_VerticesOfOneComponentAreApart(mesh, t) => mesh.Check_VerticesOfOneComponentAreApartWithComponents(mesh.ComponentsOf, t)`
  - `CheckComponents(mesh, law, holds) => mesh.ComponentsOf.CheckComponentsGiven(law, holds)` (move `CheckComponentsGiven` into the Helpers section)
- 07 validation-checks-reports.library.plato `ModelMeshReport`: `StructureChecks => mesh.ModelMeshStructureReport(t)`, deleting the 29-entry list there (the list now lives in `ModelMeshStructureReportCounted`, one copy).
- Laws: move `Witness_ComponentChecksWork` and `ComponentChecksWorkAt` into a 07 laws file (`validation-work.laws.plato` or `validation.laws.plato`); move `MisrootedComponents`, `RootIsLowestGrid`, `RootIsLowestLinearAgreesOn`, `RootsBelowAgreesOn`, `Law_Perf_RootIsLowestLinearAgrees(OnAnyTable)` and `Law_Perf_FailingComponentChecksNameTheirCell` into 07 as `Law_ComponentRootIsLowestLinearAgreesWithGrid` and siblings (they compare the linear check with the grid, which stays meaningful after wiring). After wiring, `Law_Perf_ComponentChecksAgree*`, `Law_Perf_StructureReportAgrees*` and `Law_Perf_MeshedStructureReportAgrees` compare a function with itself: delete them and `component-checks-meshed.laws.plato`.

## Contract requests
- none: every function is an addition; the library's signatures stay and delegate.

## Requests to other tracks
- none.

## Findings
- Results are bit-identical: every Given form is its law's expression with the rebuilt value passed in, and every agreement law compares Checks and Reports field for field (`Identical`), on failing cases too (the misrooted table fails the root and numbering checks at elements 3 and 1; the pinched pair fails the pinch check at vertex 0).
- Linear root check, stated and shown: the grid's sample (r, e) fails exactly when r is a root and e < r shares r's component, and its provenance is AtElement(r) for every e. So the grid fails exactly when some root is not the lowest element of its component, and the first failure in row-major order is in the row of the smallest such root, with provenance AtElement of that root: the first failing sample of the per-element check. WorseOf keeps the left check on a tie, so both folds keep their seed when every sample holds. Header of `validation-checks-components.library.plato`; `Law_Perf_RootIsLowestLinearAgrees(OnAnyTable)` on consistent, misrooted and 25 generated tables.
- The plan names the count "ComponentsOf builds per report = 1". The Structure report also builds the incidence, the edge table, ComponentCountsOf, IsWellFormed and HasAllValidCorners once each; the library's checks rebuild CountsOf (edge table, components and every component's counts) about four times per component per genus or angle law, and ComponentsOf several times per element per per-element check and per sample of the N x N grid.
- Left as they were, outside this row: the per-component angle-defect sums still read every element once per component (O(C N)); `ComponentCountsOfIndexed` is O(C (V + E)) (M2's finding); `CoincidentVertexPairs` is O(V^2) (candidate 32, chunk V7). The SelfTest family's component checks (`Check_ElementCornersShareItsComponent`, `Check_ComponentEulerCharacteristicsAddUp`, `Check_EulerIsTwoMinusTwiceGenusMinusBoundaryCycles`, `Check_VectorAreaVanishes`, `Check_ClosedComponentEulerIsTwoMinusTwiceGenus`, `Check_ReportedPairIsCoincident`, `Check_CoincidentPairIsReported`) still rebuild ComponentsOf or CountsOf per case; the same `MeshComponentTables` would serve them, a follow-up of the same shape.
- `Law_ComponentsAreNumberedByRoot`'s `RootsBelow` is O(N) per case, so the library check is O(N^2) even with the components bound once; the root tables make it linear.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, ticket, layer 06 topology, incidence, measures, layer 07 checks and report, V2's staged laws) | 15 min | |
| Writing | 20 min | |
| Laws, interpreted | 3 min | 4 runs: staged laws (12 s, all pass first time), a work probe, kept laws (33 s and 20 s with the baseline) |
| Compiled runs | 2 min | 2 runs: the first stopped in 13 s on `NeedsRefinementCached` (the supervisor's R2 merge in progress, outside this fence); the second 65 s: `dotnet C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll run stdlib/foundation stdlib/geometry stdlib/graphics C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-mesh-staging/perf-component-checks --recursive --exclude=brep.types.plato --exclude=brep.library.plato --exclude=brep.concepts.plato --laws --backend=csharp --profile=cpu64 --budget=2 --abandon=20 --filter=ComponentChecksGivenLaws,ComponentChecksMeshedLaws,Law_WorkIsWithinSlope`, 9 of 9 pass |
| Waiting | 3 min | for the R2 merge to land its files |

## Lessons
- A function that states a law over a precomputed table is named `<Law>Given`, never `Law_...`: the runner runs every `Law_` function on generated arguments, and a generated table does not match its mesh.
