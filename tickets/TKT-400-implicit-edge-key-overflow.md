---
id: TKT-400
title: STEP mesher: implicit edge use keys overflow 32-bit Integer above about 32,768 poly points per shell
status: claimed
depends_on: []
owner: session 53a578f9
session: 53a578f9-98e0-45c4-bc66-a8c1cacb3bae
fence: [sandbox/step-brep-mesh/02-topology/topology-faceted.*, sandbox/step-brep-mesh/08-pipeline/pipeline-faceted.laws.plato]
workflow: [kept]
related: [TKT-377]
created: 2026-10-21
claimed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] An implicit edge use is keyed so that two distinct edges never share a key at any poly point count a 32-bit Integer can index
- [ ] A law over a witness shell with more than 32,768 poly points agrees with the pairwise reference

Found while building V9 (TKT-377, poly-loop points identified on a tolerance grid). ImplicitEdgeUsesByOffsets (sandbox/step-brep-mesh/02-topology/topology-faceted.library.plato) packs the two point roots of an implicit edge use into one Integer key. Above about 32,768 poly points in one shell the packed key overflows Plato's 32-bit Integer, so distinct edges can share a key and the Euler, boundary-cycle, free-edge and use-defect checks over that shell can be wrong. Fix: key by a sorted pair of two Integers (or a 64-bit key once Plato has one).
