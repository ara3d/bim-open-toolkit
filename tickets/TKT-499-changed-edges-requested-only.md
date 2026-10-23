---
id: TKT-499
title: STEP mesher: ChangedEdges compares every edge every refinement round
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/08-pipeline/pipeline.library.plato, sandbox/step-brep-mesh/08-pipeline/pipeline-changed-edges.laws.plato]
workflow: [W3]
related: [TKT-323]
created: 2026-10-22
---

## Acceptance criteria

- [ ] ChangedEdgesAmong compares only the edges the requests name and agrees with ChangedEdges on every run witness (Law_ChangedEdgesAmongAgrees)
- [ ] The corpus digests are unchanged

Smaller item of docs/plans/step-mesher-algorithmic-performance-2026-10-22.md: ChangedEdges (pipeline.library.plato:165) compares every edge's arrays every round; only requested edges can change. The caller StepRemeshed is in pipeline-host-options.library.plato, outside this fence; wiring is reported.
