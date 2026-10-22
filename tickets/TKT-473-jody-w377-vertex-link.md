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
