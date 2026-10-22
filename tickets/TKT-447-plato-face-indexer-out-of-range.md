---
id: TKT-447
title: Plato: the generated TriangleFace and QuadFace indexers return the last corner for any out-of-range index
status: done
depends_on: []
owner: session d4d90dea
session: d4d90dea-61e0-4f1a-a95f-0b07841d3970
fence: [C:/Users/cdigg/git/plato/writers/**, C:/Users/cdigg/git/plato/stdlib/geometry/meshes*.plato, C:/Users/cdigg/git/plato/src/Plato.Interpreter/**, C:/Users/cdigg/git/plato/tests/**]
workflow: [W3]
related: [TKT-435]
confidence: high
created: 2026-10-22
claimed: 2026-10-22
closed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [x] TriangleFace's indexer at 3 or -1, and QuadFace's at 4 or -1, throw (or return a value the docs name) in both the interpreter and the generated C#, and a test shows it
- [x] The interpreter and C# agree on the out-of-range case

Review: docs/plans/step-mesher-types-review-2026-10-22.md (TKT-435). Generated _TriangleFace.g.cs:86 is i==0?A:i==1?B:C, so tri[3] returns C silently; the STEP mesher indexes corners by position (j + 1 mod 3 written by hand at 107 places in layer 5), so an off-by-one there is invisible. Can start now.
