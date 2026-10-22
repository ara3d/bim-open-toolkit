---
id: TKT-457
title: STEP mesher: Law_WitnessMeshValidatesClean names two claims: the law requires the whole outcome report clean, the law runner writes its row from mesh validation only
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/08-pipeline/pipeline-meshed-witness.laws.plato, sandbox/step-brep-mesh/09-tooling/tooling-law-runner-once.library.plato]
workflow: [W3, W4]
related: [TKT-323]
confidence: high
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] one claim under the name, decided and written in the law's comment; the runner's row and the law agree on every witness

From docs/plans/step-mesher-consolidation-2026-10-22.md (layers 08-09). Law_WitnessMeshValidatesClean (pipeline-meshed-witness.laws.plato:43) requires the whole outcome report to be clean; WitnessMeshValidatesCleanOf (tooling-law-runner-once.library.plato:117) checks only the mesh validation and the runner reports it under the same name. A verdict table can therefore say pass for a claim nobody checked.
