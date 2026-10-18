---
id: TKT-306
title: Does the C# STEP reader replace the Plato STEP library of TKT-299, and which PROJECT.md workflow does STEP serve?
status: open
depends_on: []
owner:
fence: []
workflow: [W3, W4]
related: [TKT-299, TKT-300]
created: 2026-10-17
kind: question
---

Plan: docs/plans/step-reader.md (reading STEP geometry in C# the way IFC is read: generated schema types from EXPRESS via Parakeet). (1) Replace sandbox/step-brep-mesh or run beside it as the working path? Default: run beside it; the C# reader is the working path, the Plato specification continues unchanged. (2) PROJECT.md does not mention STEP. Default: product models (equipment, fixtures) shown with the building in the 3D view, under workflows 3 and 4.

## Answer to (1), 2026-10-17

The owner: reuse the C# reader and parser, write the geometry algorithms in Plato. The C# side parses (Ara3D.IO.StepParser), types (Ara3D.StepTypes), decodes into the Plato library's BrepModel (TKT-312), and assembles the model (units, placements, assemblies, colours, entry point: TKT-305). The Plato library (TKT-299) implements the geometry, compiled to C# and called from Ara3D.Step.Mesher (TKT-313). The boundary moves from Part21File to BrepModel, which removes decoding by string name from Plato (finding F-1, TKT-300). First step: TKT-311, whether Plato's C# writer compiles the library's constructs today. Question (2), which workflow STEP serves, is still open; default as above.
