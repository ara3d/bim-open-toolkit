---
id: TKT-489
title: STEP mesher: state that the contract check is harness-only and never runs in production
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Step.Mesher/**, deps/bim-open-data/tools/step-corpus-harness/**, deps.json]
workflow: [process]
created: 2026-10-22
---

## Acceptance criteria

- [ ] Finding recorded: the production host path (StepMesher.Mesh, StepPlatoMesher.MeshFile) never calls the version 1 contract check; it exists only in the corpus harness and tests
- [ ] StepPlatoMesher.MeshFile's summary says so

Finding: MeshFile runs decode, PrepareModel, edge discretization, face outcomes, the blocking refinement loop and assembly. None of Validated, ValidateModelMesh or CrossCheck (layer 7) is reached from it; MeshingOptions.Level is read by none of the functions it calls. ContractCheck, MeshCheck and BoundaryCheck live in tools/step-corpus-harness and run from TimedMesh. So Release already skips the check; no option is needed. 6.5 s of 177 s in the corpus run is harness time only.
