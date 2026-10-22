---
id: TKT-473
title: STEP mesher: vertex 2376 of the two M2-JODY-W377 files has a link that is neither a cycle nor a path in its open shell after PrepareModel
status: open
depends_on: []
owner: v1-jody
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

## Handed to v1-jody (supervisor, 2026-10-22)

J6 sews duplicate edges between one vertex pair with agreeing curves, which may already cover this seam (two edges on
identical line curves). If it does, J6 takes face 470 as an extra case, with the extract command above as its witness.
If it does not, this ticket is deferred past version 1: an open shell meets the version 1 contract either way.

## Log

- 2026-10-22, session 260aa3fa (track v1-jody): J6 (TKT-467, staged in v1-jody, 29c65617) does not sew this seam, so by the ruling above this ticket is deferred past version 1. J6 sews only shells the file declares closed (option A: an open shell's boundary is the file's statement), and face 470 is alone in an open shell. The edge rule itself would cover the case: edges 2376 and 2378 are each cited once, join one vertex pair, and lie on identical line curves, so `ShellEdgeMerges` would merge them, reversing the coedge that runs the other way, into one seam edge the face cites twice. If the seam is wanted later, the smallest extension is to apply that edge rule, in any shell, to two once-cited edges of one face (a face's own seam), leaving the closed-shell restriction for everything else.
