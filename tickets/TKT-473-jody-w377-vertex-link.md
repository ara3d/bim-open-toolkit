---
id: TKT-473
title: STEP mesher: vertex 2376 of the two M2-JODY-W377 files has a link that is neither a cycle nor a path in its open shell after PrepareModel
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/03-step/**]
workflow: [W3]
related: [TKT-441, TKT-431]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] OpenShellVertexLinkIsCycleOrPath passes on the prepared models of SHO/M2-JODY-W377-00C_PCIE-UART.step and -01C_SDIO-UART.step, or the vertex is reported by a located diagnostic

Found by layer 7's checks on every corpus file (TKT-441; docs/plans/step-mesher-reliability-2026-10-22.md (TKT-441 section); run: step-corpus-harness all <corpus> <out> 300 --child laws, bim-open-data 97495d8, library before J5): OpenShellVertexLinkIsCycleOrPath fails at BrepVertexIndex(2376) in both files, raw and prepared. The MAYA REVC files fail it on the raw model only (PrepareModel's loop chaining, v1-edges E1, mends them). Possibly the same faces as TKT-431's 24 closed B-spline edges; not traced.

## Diagnosis (v1-reliability, 2026-10-22)

The check is right and the mesh carries no non-manifold edge. Vertex 2376 lies on one face only, face 470: a
cylinder 0.4 mm in radius and 0.01 mm tall, alone in its own open shell (shell 470). Its loop is
[edge 2376 reversed, circle 2377 forward, edge 2378 forward]: the seam is written as two edges, 2376 and 2378, on
identical line curves (origin (2.33, 15.48, -0.795), direction +z, both from vertex 2376 to 2377), each used once,
where a seam is one edge used twice. So the face is cut open along its seam, and its two corners at vertex 2376,
on either side of the cut, share only the vertex: two link components, a pinch, which the law reports correctly.
The same face and edges appear in both files.

In the mesh (harness, both files): 1,306 of 1,306 faces meshed, 0 non-manifold and 0 misoriented edges, contract
holds; face 470 meshes as a 24-quad grid with a zero-width slit along the seam, two coincident boundary lines counted
among the files' 6,544 boundary edges. In an open shell that is not a contract violation, but it is an unsewn seam.

Fix: sew the two coincident edges into one seam edge used twice. That is a preparation repair of the kind J6
(sewing, v1-jody) builds, within one face rather than between faces. Witness: `step-corpus-harness extract
SHO/M2-JODY-W377-00C_PCIE-UART.step 470 <out.plato>` reproduces the face (24 quads, same mesh).
