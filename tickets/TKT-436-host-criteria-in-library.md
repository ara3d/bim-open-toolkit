---
id: TKT-436
title: STEP mesher reliability: laws mesh with the host's criteria: one definition of the host's meshing criteria in layer 8, called by StepPlatoMesher.Criteria and by the witness-meshing laws
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/08-pipeline/**, deps/bim-open-data/src/data/Ara3D.Step.Mesher/Plato/StepPlatoMesher.cs]
workflow: [W3]
related: [TKT-415, TKT-405]
confidence: high
created: 2026-10-22
---

## Acceptance criteria

- [ ] a layer 8 function gives the criteria the host meshes with (quads preferred, chordal-only refinement, the round limit) from a chordal bound, and StepPlatoMesher.Criteria returns it
- [ ] MeshedWitness and the gate witnesses mesh with that function, and a law fails if MeshingOptions.WitnessOptions differs from it in any field but the chordal bound

Reliability report docs/plans/step-mesher-reliability-2026-10-22.md, class D (the host does work the laws never see). TKT-415's flat quad passed every law because the witness laws meshed with triangles (MeshedWitness) while the host preferred quads since TKT-405. Needs the supervisor (layer 8) and v1-proof (StepPlatoMesher.cs).
