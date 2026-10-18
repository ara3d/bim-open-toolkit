---
id: TKT-314
title: Implement chunk A of the STEP B-rep mesh library: the unit cube through every layer on witnesses
status: open
depends_on: [TKT-299]
owner:
fence: [sandbox/step-brep-mesh/**]
workflow: [W3, W4]
confidence: high
created: 2026-10-17
---

## Acceptance criteria

- [ ] every function TASKS.md chunk A lists has a body, and the deferred-body count in each layer README is updated
- [ ] layer 2's laws pass on the ten positive witnesses and fail exactly as stated on the three negative ones, through the Plato law runner over the C# backend
- [ ] Witness_UnitBox meshes through MeshModel to 8 vertices and 12 triangles, closed, oriented, reduced Euler characteristic 2, signed volume 1, Rounds 0, Ok true, and every law TASKS.md chunk A lists passes
- [ ] the gate stays at PASS with zero errors in scope, and the mechanical items of reviews/FINDINGS.md F-48 (1, 2, 4, 5) and F-47.4 are applied in the first commit

Owner approval 2026-10-17 ("go for it" on the recommendation in the TKT-299 session). The first implementation chunk of sandbox/step-brep-mesh/TASKS.md: witness-driven, no STEP file read, 32-bit Number suffices. Runs beside TKT-311 (does the C# writer compile the library's constructs), the 64-bit Number profile, and TKT-312 (the C# decoder to RawDecodedModel). The boundary agent of TKT-299 is editing 03-step and 07-validation/validation-witnesses.library.plato at the same time; chunk A touches those two last.
