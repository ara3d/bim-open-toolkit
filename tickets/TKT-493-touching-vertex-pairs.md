---
id: TKT-493
title: STEP mesher: two touching hole corners in LENA-R8 face 258 are separate vertex records within the tolerance, so the region crosses itself; merge such an isolated pair in PrepareModel
status: done
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/v1-jody/**, sandbox/step-brep-mesh/03-step/**]
workflow: [W3]
related: [TKT-472, TKT-467]
created: 2026-10-22
closed: 2026-10-23
kind: defect
---

## Acceptance criteria

- [ ] PrepareModel merges two vertices of one shell that lie within the length tolerance of each other and of no third vertex, each on an edge ending at the other, with a repair record and a located diagnostic; no chain beyond the pair
- [ ] A law over a witness with such a pair states the merge, and fails on the current library
- [ ] CEL/LENA-R8.STEP face 258 meshes, its shell closes with 0 non-manifold edges, every other corpus file is unchanged, and TKT-472's MAX and ZOE files keep their meshes

From the v1 supervisor (2026-10-22), after v1-edges' E5 profiling. In CEL/LENA-R8.STEP face 258 two hole loops touch corner to corner twice: vertices 2516 and 2517 are 2.5e-6 apart and 2569 and 2570 6.3e-6 apart (length tolerance 0.01). Each vertex also ends a wall edge from one shared vertex (2540 to 2516 between faces 1477 and 1478, 2540 to 2517 between faces 1369 and 1370; likewise at 2588): two pockets touching along a line. Reduced merges only vertices that an edge or a loop's head-to-tail joint brings together, so the pairs stay apart and the region crosses itself within the tolerance (FACE-LOOP-NOT-SIMPLE). Welding them inside the face (v1-edges) made 6 non-manifold edges, because the mesh edge between them belonged to two model edges. Merging the model vertices only, with the wall edges kept separate, keeps every mesh edge manifold. TKT-472 showed that a wider merge (a raised tolerance) joins distinct vertices in MAX and ZOE.

## Log

- 2026-10-23, session 260aa3fa (track v1-jody, J11): the welds the rule asks for make the mesh non-manifold. On C# regenerated from toolkit eb507dff with J11 wired in (Plato 6013475, 0 degraded bodies), CEL/LENA-R8 face 258 meshes (its 2,026 boundary edges beside an unmeshed face go to 0) but the file goes from 0 to 20 non-manifold and 0 to 40 misoriented edges and is no longer oriented. A probe of the welds: LENA-R8 has 20 isolated coincident vertex pairs in one shell, not 2; 18 of them are exactly coincident (distance 0), and one (539 into 500) is 0.0071 apart under the 0.01 tolerance. All but that one are pockets touching along a line, as 2516/2517 and 2569/2570 are: each vertex of the pair ends a wall edge from one shared top vertex (2540 to 2516 between faces 1477 and 1478, 2540 to 2517 between faces 1369 and 1370). Welding the pair makes the two wall edges run between the same two vertices along one line, each cited by two faces, so the mesh edge on that line has four faces: one non-manifold edge per weld. Left unwelded, the walls keep separate bottom vertices and the mesh is manifold; only face 258's region crosses itself, because its two hole corners lie within the tolerance. So no merge of model vertices gives both a meshed face 258 and 0 non-manifold edges: the touching corners have to stay two vertices, and the crossing has to be resolved inside face 258's region (v1-edges' E5d, which the E5d prototype already resolves for LENA-R8 258: 4 crossings to 0, an exact cover). Staged for the record as `J11.patch` (not to merge): `PairsWelded` (step-vertex-pairs.library.plato), `Sewn`'s raw rewrite shared as `WithMerges`, the code `VertexPairWelded`, and four laws that pass on a patched copy (the hand-built touching-holes witness welds and meshes; only classes of two are pairs; no positive or raw witness welds). Decision asked of the v1 supervisor.

## Closed with criteria unmet

2026-10-23: Superseded by v1-edges' E5d (supervisor's decision, 2026-10-23). A probe of the welds (v1-jody J11) found 20 isolated coincident vertex pairs in LENA-R8's shell, 18 exactly coincident: pockets touching along a line, where welding makes two wall edges coincide and the mesh edge has four faces (0 to 20 non-manifold, 0 to 40 misoriented). The touching corners stay two vertices; face 258's crossing is resolved inside its region by E5d. J11.patch is kept in v1-jody for the record.
