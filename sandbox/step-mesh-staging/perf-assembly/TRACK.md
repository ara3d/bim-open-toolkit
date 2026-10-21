# perf-assembly: number and assemble the model mesh in linear time (complexity sweep chunk M1)

Ticket: TKT-366
Status: merged: M1 (2026-10-21, files moved into 06-mesh as mesh-numbering-indexed, mesh-assembly-indexed, mesh-assembly-witness.types, mesh-assembly-indexed.laws)

## Done
- M1, the commit that adds this file, about 0.5 h against 2 h expected. Candidates 8 and 9 of `docs/plans/step-mesher-complexity.md`.
  - Added (`mesh-numbering-indexed.library.plato`, library `ModelMeshNumberingIndexed`): `EdgeCited(s)`, `CitedEdges(faceMeshes, edgeCount)` and `CitedEdgesCounted`, `NumberMeshVerticesMarked(m, d, faceMeshes)` and `NumberMeshVerticesCounted`, `FaceInteriorRanks(fm)`, `RankAt`, `InteriorSiteRanked`, `SiteOfSourceRanked`, `GlobalVerticesOf(n, fm)`, `GlobalAt(globals, i)`.
  - Added (`mesh-assembly-indexed.library.plato`, library `ModelMeshAssemblyIndexed`): `AssembledTriangles`, `AssembledQuads`, `AssembleModelMeshIndexed(m, faceMeshes, numbering)`.
  - Type added: `AssemblyWitness` (`assembly-witness.types.plato`): a model, its discretizations and its face meshes, built once per sweep, so the numbering and assembly laws read layer 06's inputs without meshing per case. L1's `MeshedWitness` holds the finished outcome, which does not expose the face meshes.
  - Laws (`mesh-assembly-indexed.laws.plato`, library `ModelMeshAssemblyIndexedLaws`), each over the two witnesses `Witness_UnitBoxAssembly` (one segment per edge) and `Witness_FineBoxAssembly` (four segments per edge, 24 face-interior points; exact sizes under Findings): `Law_Perf_CitedEdgesAgree`, `Law_Perf_NumberMeshVerticesMarkedAgrees` (same numbering, and work exactly E + S + L), `Law_Perf_FaceInteriorRanksAgree` (every rank from -1 to L + 1), `Law_Perf_GlobalVerticesOfAgree` (every point from -1 to P), `Law_Perf_AssembleModelMeshIndexedAgrees` (every field of the mesh, exactly), `Law_Perf_AssemblyWitnessCanAssemble` (the agreement is not vacuous).
  - Count witness `Witness_NumberMeshVerticesWork`: Insertions (sources visited, edge flags set, provenance entries read), slope `Insertions(2)`, sizes E + S = 36 (unit box) and 132 (four-segment box); measured 60 and 252 (allowances 72 and 264). The original's `CitesEdge` scan is E S source visits: 288 and 1,440.
  - Interpreter (warm server, cpu64, budget 20): `ModelMeshNumberingLaws`, `ModelMeshAssemblyLaws`, `Law_AreaIsSumOfFaceMeshAreas`, `ModelMeshAssemblyIndexedLaws`, `Law_WorkIsWithinSlope`: 25 laws, 25 pass, 0 type errors. Every original law keeps its `pass` in `reviews/verdicts-cpu64.tsv`.
  - Compiled, from `C:/Users/cdigg/git/plato`: `dotnet C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll run stdlib/foundation stdlib/geometry stdlib/graphics C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-mesh-staging/perf-assembly --recursive --exclude=brep.types.plato --exclude=brep.library.plato --exclude=brep.concepts.plato --laws --backend=csharp --profile=cpu64 --budget=2 --filter=ModelMeshNumberingLaws,ModelMeshAssemblyLaws,Law_AreaIsSumOfFaceMeshAreas,ModelMeshAssemblyIndexedLaws,Law_WorkIsWithinSlope`: 25 laws, 25 pass; slowest `Law_WorkIsWithinSlope` 0.11 s over its 2 cases; 18 witnesses 0.4 s; total 37.8 s. The one degraded body the run reports is in the library (it appears without this folder).

## Merge instructions
- `06-mesh/mesh-numbering.library.plato`: `NumberMeshVertices(m, d, faceMeshes)` => `NumberMeshVerticesCounted(m, d, faceMeshes).Value`; move the functions of `mesh-numbering-indexed.library.plato` into it (section "Building the numbering" for the cited edges and the counted numbering, section "Face mesh points to sites and global vertices" for the ranks and `GlobalVerticesOf`), and drop the "Reference body: CitesEdge makes it quadratic" sentence from `NumberMeshVertices`' comment. Keep `CitesEdge`, `FaceInteriorRank` and `GlobalVertexOf`: the laws state the contract through them.
- `06-mesh/mesh-assembly.library.plato`: `AssembleModelMesh(m, faceMeshes, numbering)` => `AssembleModelMeshIndexed(m, faceMeshes, numbering)`, or move the body in under the old name with `AssembledTriangles` and `AssembledQuads`.
- `assembly-witness.types.plato` => `06-mesh/mesh-numbering.types.plato` (or fold into L1's witness types if that file holds them); the laws file => `06-mesh/mesh-assembly-indexed.laws.plato` or appended to `mesh-assembly.laws.plato`, `Law_Perf_*` renamed `Law_*`. After the wiring the agreement laws compare the function with itself; keep `Law_*CitedEdgesAgree`, `Law_*FaceInteriorRanksAgree`, `Law_*GlobalVerticesOfAgree` (they compare against the reference functions that stay) and drop the two that would become self-comparisons (`NumberMeshVerticesMarkedAgrees` keeps only its work clause, `AssembleModelMeshIndexedAgrees` goes).
- `07-validation/poles.laws.plato` line 144 (`RoundZeroModelMesh`) and every other caller need no edit: they call the plain names.

## Contract requests
- None. The staged functions use only signatures the library declares.

## Requests to other tracks
- None.

## Findings
- Exact sizes of the count witness, found by probe laws: unit box E = 12, S = 24, L = 24, work 60; four-segment box E = 12, S = 120 (96 boundary sources and 24 face-interior points), L = 120, work 252. Work is E + S + L = 2 (E + S) - E on a box, whose points all map to their own local vertex.
- The dispatch names `SeamCopiesShareOneGlobalVertex`, `DistinctLocalVerticesHaveDistinctGlobalVertices`, `SharedBoundarySampleHasOneGlobalVertex` and `FaceMeshPointHasNumberedSite` as laws to keep. In `ModelMeshNumberingLaws` they carry no `Law_` prefix, so the runner never runs them and `verdicts-cpu64.tsv` has no verdict for them. Their claims are about `GlobalVertexOf`, which `Law_Perf_GlobalVerticesOfAgree` shows `GlobalVerticesOf` reproduces exactly, so they hold of the replacement whenever they hold of the original.
- The box witnesses have no seam or pole points, so `InteriorSiteRanked` is reached only through the `Interior` branch of `SiteOfSourceRanked`; the `SeamCut` and `Pole` branches call the same function. A seamed witness (cylinder) would cover them but costs a curved-face mesh per sweep (TKT-356).
- The original laws over `Array<FaceMesh>` (all of `ModelMeshAssemblyLaws`, `Law_AreaIsSumOfFaceMeshAreas`) run on 25 generated cases each, most of them refused by `CanAssemble`. An `AssemblyWitness` form of those laws would give them inputs that `CanAssemble` accepts.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, staging README, layer 06 files, W0 files, witnesses) | 12 min | |
| Writing (two libraries, type, laws, TRACK.md) | 12 min | |
| Law runs, interpreter | 3 min | 1 parse-error run (ToString does not exist), 1 pinned-CLI interpreter run, 2 probe runs, 1 warm-server run |
| Compiled runs | 2 min | 1 with the folder, 1 without (to place the degraded body) |
| Waiting | 0 min | |

## Lessons
- `Integer.ToString` does not resolve in this Plato; the warm server reports it only as "0 laws", and the pinned CLI without `--backend=csharp` names it.
- Exact witness sizes are found fastest by a scratch probe folder of `==` laws passed as an extra root to the pinned CLI, outside the fence.
