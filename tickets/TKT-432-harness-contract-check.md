---
id: TKT-432
title: STEP mesher reliability: the corpus harness checks the version 1 contract on every face of every file (chordal by sampling against the surface, orientation against the surface normal, no degenerate element, every face meshed or explained)
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/tools/step-corpus-harness/**]
workflow: [W3]
related: [TKT-415, TKT-413, TKT-421]
confidence: high
created: 2026-10-22
---

## Acceptance criteria

- [ ] time, all and gallery modes report a contract verdict per file and write the failing faces to <prefix>.contract.csv
- [ ] the bump solid at 0.3 (TKT-415) breaks the check on the library before v1-faces F1, and the unit box and cylinder pass
- [ ] four corpus files run with the check, its cost recorded

Reliability report docs/plans/step-mesher-reliability-2026-10-22.md, class C (properties stated on parts or generated values, never on the mesh a file produces). The check is written in C# from the face meshes and the surfaces alone, so it is independent of layer 7's checks and of the laws over them.
