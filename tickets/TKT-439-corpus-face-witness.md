---
id: TKT-439
title: STEP mesher reliability: a corpus face that breaks the contract becomes a witness: the harness writes the face and its edges as a Plato BrepModel literal in a staging folder
status: done
depends_on: []
owner:
fence: [deps/bim-open-data/tools/step-corpus-harness/**, sandbox/step-brep-mesh/09-tooling/**]
workflow: [W3]
related: [TKT-432, TKT-411, TKT-414]
confidence: medium
created: 2026-10-22
closed: 2026-10-22
---

## Acceptance criteria

- [x] step-corpus-harness extract <file> <face> <out.plato> writes a Witness_<File>Face<n>() returning a BrepModel of that face, its loops, edges, vertices, curves and surface
- [ ] the extracted LENA-R8 sphere lune (TKT-411) parses and meshes in the law runner to the same face mesh digest as in the file

Reliability report docs/plans/step-mesher-reliability-2026-10-22.md, class B (witnesses do not cover the corpus's cases). TKT-411, TKT-414, TKT-419, TKT-420 and TKT-421 were each found on a corpus face no witness resembled, and each track then built a probe by hand to reach it.

## Closed with criteria unmet

2026-10-22: The supervisor chose ANN-MB2 face 349 (not simple in the 2026-10-22 corpus run) in place of the LENA-R8 lune, which v1-faces F3 had already fixed. The harness compares the face's branch and mesh digest in the file and in the witness (same, ring 0 and 1); the law runner parses the witness and meshes it to the same unmeshed outcome (FACE-ZERO-WIDTH, Law_V1Reliability_AnnMb2Face349IsMeshed fails with measure 1). The law runner does not compute the harness digest, so 'the same digest' there is the same outcome.
