---
id: TKT-482
title: STEP mesher gallery: first-level operation witnesses, auto verdicts and a status summary
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/07-validation/operation-witnesses.*, sandbox/step-brep-mesh/08-pipeline/pipeline-operation-witnesses.library.plato, sandbox/step-brep-mesh/tools/cross_hole_spline.py, deps/bim-open-data/tools/step-corpus-harness/gallery-page.py, deps/bim-open-data/src/data/Ara3D.StepBrep/**, docs/plans/step-mesher-gallery.md, deps.json]
workflow: [W3]
related: [TKT-435]
created: 2026-10-22
---

## Acceptance criteria

- [ ] Twenty-two Plato witnesses, one per first-level operation (hexagon, L bracket, chamfer, fillet, extruded fillet, inner fillet, slot, D-shaft, pyramid, blind hole, boss, counterbore, countersink, sphere dimple and dome, open box, tube, oblique cut, torus fillet, revolved barrel and cone, cross hole with B-spline edges), each with stated counts, genus and volume, pass the operation-witness laws and are registered as meshed witnesses
- [ ] The gallery has an operations group meshing every witness through witness:<Name>, a verdict derived from the sidecar instead of typed by hand, and a status table at the top: per group, cases that mesh clean, faces meshed, and face time
- [ ] Ara3D.StepBrep is regenerated from the committed library and the bim-open-data pin moved; docs/plans/step-mesher-gallery.md records the run

The owner asked on 2026-10-22 for the gallery to cover the common first-level operations (intersections and cuts), not only primitives and whole parts, and to show how far meshing has come, how long it takes and what is covered. The witnesses are Plato values so the library's 157 laws over BrepModel and the meshed-witness laws run on them too (decided over a Python STEP writer, which would have covered the decoder but tested nothing).
