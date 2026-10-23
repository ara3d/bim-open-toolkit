---
id: TKT-490
title: STEP mesher: measured experiment on trimmed curved faces: a structured UV grid kept as quads inside the trim, a CDT and refinement only on the band of cells the boundary crosses
status: open
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/trim-band/**, docs/plans/step-mesher-trim-band-2026-10-22.md, sandbox/step-brep-mesh/05-face-meshing/trim-band*.plato]
workflow: [W3]
related: [TKT-405, TKT-409, TKT-415, TKT-435]
created: 2026-10-22
---

## Acceptance criteria

- [ ] A throwaway measurement (scratchpad or sandbox/step-mesh-staging/trim-band/) over trimmed curved corpus faces that take CDT today reports per face: interior and band cell counts, the band's share of points, elements against today's triangles, the worst deviation by dense sampling, and time per face for grid plus band CDT plus band refinement against today's MeshFace time, by surface kind
- [ ] The verdict with its numbers is in docs/plans/step-mesher-trim-band-2026-10-22.md before any library change; it works only if every element is within the chordal bound, the mesh stays watertight, elements are at most about 2x today's, and face time on the faces covered drops by several times
- [ ] If it works: a band mesher in new library files with laws (the band takes every boundary point; every interior cell is inside the region; interior cells and band triangles cover the region exactly with no overlap; every element is within the chordal bound), wired as a path for trimmed faces with today's path as the fallback, and a corpus run against step-mesher-corpus-2026-10-22-late with no fewer faces meshed, shells closed, or files passing the contract

Today a trimmed curved face is a CDT of its whole UV region plus up to 40 refinement rounds, which is 68 to 82% of curved face time (docs/plans/step-mesher-ideas-evaluation.md, runs A and E). Only four-sided mappable faces take QuadGridOnSides. The experiment lays a structured grid over the UV domain, keeps cells wholly inside the trim as quads, and runs the CDT and refinement only on the band of cells the boundary crosses, with the boundary edge polylines' points. Cell size comes from the sampled cell test unless the closed-form (analytic) or derivative-bound (B-spline) sizing of the parallel tracks has landed. Other tracks own QuadGridOnSides, grid-chordal.*, grid-keep.*, the quad-count requests, and the refinement files; changes they need are asked for in the report.
