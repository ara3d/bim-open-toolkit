---
id: TKT-245
title: Parity ratchets: committed floors the gates read
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/bench/ifc-mesher/ratchets.json, deps/bim-open-data/tests/data/Ara3D.IfcMeshingComparison/Tests/Comparison/ParityGates.cs]
workflow: [W3]
related: [TKT-65, TKT-190]
created: 2026-10-11
---

## Acceptance criteria

- [ ] bench/ifc-mesher/ratchets.json holds a parity floor per quick file and the Supported coverage count; ParityGates reads the floors instead of hard-coding 0.85
- [ ] A drop below a floor fails the gate; a run that beats a floor may raise it in the same commit

Track E1 of docs/plans/ifc-mesher-roadmap.md.
