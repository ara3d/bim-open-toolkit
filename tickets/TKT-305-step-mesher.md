---
id: TKT-305
title: Mesh STEP B-reps through Ara3D.StepTypes and Ara3D.MeshKernel: readers, units, assembly tree
status: open
depends_on: [TKT-304]
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Step*/**, deps/bim-open-data/src/data/Ara3D.MeshKernel/**, deps/bim-open-data/src/data/Ara3D.Ifc.Mesher/FaceSetBuilder.cs, deps/bim-open-data/tests/data/**, deps.json]
workflow: [W3, W4]
related: [TKT-250]
confidence: high
created: 2026-10-17
---

## Acceptance criteria

- [ ] a public AP242 or AP214 sample meshes with every solid closed and the bounds matching the file's units
- [ ] assembly instances are placed through NEXT_ASSEMBLY_USAGE_OCCURRENCE and ITEM_DEFINED_TRANSFORMATION
- [ ] non-reading code shared with the IFC mesher lives in Ara3D.MeshKernel, not copied
- [ ] unsupported entities are counted in diagnostics, never dropped silently

Plan: docs/plans/step-reader.md (reading STEP geometry in C# the way IFC is read: generated schema types from EXPRESS via Parakeet). Cones, spheres and tori are flattened by the IFC mesher today; this ticket records what it does for each surface kind.
