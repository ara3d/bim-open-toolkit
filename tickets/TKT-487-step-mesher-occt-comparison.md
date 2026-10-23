---
id: TKT-487
title: STEP mesher against OpenCascade: accuracy comparison over the u-blox corpus
status: done
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/tools/occt-compare/**, docs/plans/step-mesher-occt-comparison-*]
workflow: [W3]
related: [TKT-323]
created: 2026-10-22
closed: 2026-10-22
---

## Acceptance criteria

- [x] Both meshers run over the corpus and are measured against the exact B-rep, with scripts committed
- [x] A dated report says whether the Plato mesh is accurate, with per-file numbers

Owner's request, word for word:

> I would love to run an experiment to compare open cascade meshing (via Python is fine) with the Plato mesher. I don't mind that the meshes are not exactly the same, as long as the Plato mesh is accurate.

Done in 0d2c9afe: docs/plans/step-mesher-occt-comparison-2026-10-22.md and its CSV; scripts in sandbox/step-brep-mesh/tools/occt-compare.
