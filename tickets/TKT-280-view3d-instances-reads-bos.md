---
id: TKT-280
title: view3d.instances suggests .bos files but can only mesh IFC, so checking graphs load the building twice
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.Nodes.Geometry/**, tests/flow/BimOpenFlow.View3dWorkflows.Tests/**, samples/checking-analyses/check-ids-door-width.json, samples/checking-analyses/bcf-read-colour.json]
workflow: [W3]
created: 2026-10-12
kind: defect
---

## Acceptance criteria

- [ ] view3d.instances and view3d.measures read a .bos file (the public .bos files carry VertexBuffer, Instances, Meshes and Transforms) as well as an IFC, or stop suggesting .bos in FilesWith
- [ ] check-ids-door-width drops its second geometry input and bcf-read-colour's model input defaults to the .bos, each graph holding the building once

Found by TKT-264 (2026-10-12): the readers declare FilesWith(.bos) but ModelGeometry.cs throws Expected 'ISO-10303-21' on one, so every checking graph with a 3D side loads the building twice, once as .bos for ids.check and once as IFC for the scene.
