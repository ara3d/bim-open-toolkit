---
id: TKT-439
title: STEP mesher reliability: a corpus face that breaks the contract becomes a witness: the harness writes the face and its edges as a Plato BrepModel literal in a staging folder
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/tools/step-corpus-harness/**, sandbox/step-brep-mesh/09-tooling/**]
workflow: [W3]
related: [TKT-432, TKT-411, TKT-414]
confidence: medium
created: 2026-10-22
---

## Acceptance criteria

- [ ] step-corpus-harness extract <file> <face> <out.plato> writes a Witness_<File>Face<n>() returning a BrepModel of that face, its loops, edges, vertices, curves and surface
- [ ] the extracted LENA-R8 sphere lune (TKT-411) parses and meshes in the law runner to the same face mesh digest as in the file

Reliability report docs/plans/step-mesher-reliability-2026-10-22.md, class B (witnesses do not cover the corpus's cases). TKT-411, TKT-414, TKT-419, TKT-420 and TKT-421 were each found on a corpus face no witness resembled, and each track then built a probe by hand to reach it.
