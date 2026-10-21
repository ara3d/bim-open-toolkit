# perf-incidence: vertex-to-element incidence for components and pinched vertices (chunk M2)

Ticket: TKT-367
Status: merged: M2 (2026-10-21, into 06-mesh/mesh-incidence.{types,library,laws}.plato; the layer 08 witness pair deleted at merge, its only law would compare a function with itself)

## Done
- M2, this commit, about 0.7 h against 2 h. Added `VertexIncidence` (compressed rows: `Offsets`, `Elements`), `VertexElementIncidence(Counted)`, `ComponentsOfIndexed(Counted)`, `ComponentsOfCounted`, `LinkEdgesIndexed`, `MaxEndDegree`, `IsPinchedLink`, `IsPinchedVertexIndexed`, `CountsOfComponentIndexed`, `ComponentCountsOfIndexed` (`mesh-incidence.library.plato`); the count witness `Witness_ComponentsOfWork` and ten `Law_Perf_*` agreement laws.
  - Interpreter (cpu64, budget 20): `ModelMeshIncidenceLaws`, `ModelMeshIncidenceWitnessLaws`, `Law_WorkIsWithinSlope`: 10 laws, 10 pass. `ModelMeshTopologyLaws` and `ModelMeshMeasuresLaws`: 33 laws, 33 pass, as in `reviews/verdicts-cpu64.tsv`. `StepToMeshProofsMeshLaws` and `StepToMeshWitnessesLaws`: 28 pass and 7 errors (time budget), the same 35 verdicts as the tsv.
  - Compiled (`--backend=csharp --profile=cpu64 --budget=2`, filter `ModelMeshIncidenceLaws,ModelMeshIncidenceWitnessLaws,Law_WorkIsWithinSlope`): 10 laws, 10 pass, slowest law 0.03 s; the two meshed witnesses take 13.8 s and 6.4 s to build, once per sweep. Filter `ModelMeshIncidenceLaws,Law_WorkIsWithinSlope,ModelMeshTopologyLaws` before the split: every `ModelMeshTopologyLaws` law passes, slowest 0.11 s.
  - Count witness: Insertions (element visits: incidence entries written, row entries read, elements dequeued), slope `Insertions(4)` per unit of 3T + V, on closed fans of 8 and 64 triangles (sizes 33 and 257). Measured 56 and 448 (7 per triangle) against allowances of 132 and 1,028.
  - Types added: `VertexIncidence` (the stdlib's `JaggedArray<ElementIndex>` has the same fields, but the C# writer emits no member for a library function whose receiver is a generic instance: CS1061 on `IncidentCount`); `IncidenceMeshWitness` (a meshed model shared per sweep until chunk L1's `MeshedWitness` merges).

## Merge instructions
- Move `mesh-incidence.types.plato`, `mesh-incidence.library.plato` and `mesh-incidence.laws.plato` to `06-mesh/`; move `mesh-incidence-witnesses.types.plato` and `mesh-incidence-witnesses.laws.plato` to `08-pipeline/` (they mesh BrepModel witnesses, so they sit above layer 06). Once L1 has merged, replace `IncidenceMeshWitness` by `MeshedWitness` and read `w.Outcome.Mesh`.
- `06-mesh/mesh-topology.library.plato` `ComponentsOf(mesh)` => `mesh.ComponentsOfCounted.Value` (delete the old body with its `incident` scan).
- `ComponentCountsOf(mesh, t, comps)` => `mesh.ComponentCountsOfIndexed(t, comps, mesh.VertexElementIncidence)`.
- `CountsOfComponent(mesh, t, comps, c)` => `mesh.CountsOfComponentIndexed(t, comps, mesh.VertexElementIncidence, c)`; with both wirings in, the nine-field record is built in one place.
- Keep `IsPinchedVertex`, `LinkEdges` and `LinkMaxDegree` as they are: they are the reference the agreement laws compare against, and a caller with no incidence in hand gains nothing from building one per vertex (O(V + T) per call against the reference's O(T)). Chunk V6 builds the incidence once per report for `Check_ClosedMeshHasNoPinchedVertex`.

## Contract requests
- none

## Requests to other tracks
- V6 (TKT-374): hoist one `mesh.VertexElementIncidence` per report and call `IsPinchedVertexIndexed(mesh, incidence, v)` from `Check_ClosedMeshHasNoPinchedVertex`. Not blocking.

## Findings
- The breadth-first search reads each vertex's row once, not once per element at the vertex: the first read gives every element of the row a depth, so a later read would assign nothing, and skipping it leaves components, parents and depths identical. Without that, a row-per-corner search is still O(sum of squared vertex degrees), quadratic on a fan: k^2 + 4k reads on a fan of k triangles, 4,352 at k = 64 against the slope's 1,028.
- The incidence lists an element once per vertex even when the element repeats the vertex (a degenerate triangle), as the reference's `Any` scan does; a corner that names no position is in no row, as the reference's range guard drops it. `IsPinchedVertexIndexed` at a v that names no position falls back to `IsPinchedVertex`, whose scan can still see an out-of-range corner equal to v, so the two agree for every v.
- `PieceCount` (candidate 34, chunk V7) remains the cost of a pinch test at a high-degree vertex, O(L^4) in the link size L. `IsPinchedLink` skips it when a link degree is above 2.
- `ComponentCountsOf` remains O(components x (V + E)): every component rescans every vertex and edge. Not in this chunk's row.
- The runner generates `IncidenceMeshWitness` cases besides the two witnesses (25 cases), because `String` and `ModelMesh` are generatable; the law holds on all of them.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, plan, layer 06, primer, W0) | 12 min | |
| Writing | 12 min | |
| Law runs, interpreter | 6 min | 7 runs; the two layer 08 law classes took 2.5 min (meshing) |
| Compiled runs | 3 min | 3 runs, about 50 s each; the first failed on the JaggedArray receiver |
| Waiting | 3 min | the layer 08 run in the background |

## Lessons
- A library function whose receiver is a generic stdlib type (`JaggedArray<ElementIndex>`) passes the interpreter and fails the C# build (CS1061); a concrete record avoids it. Run the compiled check before writing the laws out.
- A law that binds `BrepModel.Witness_*.WitnessMesh` in its body re-meshes per run: 19.9 s compiled for one case. As a `Witness_*` value it costs the same once per sweep and the law 0.03 s.
