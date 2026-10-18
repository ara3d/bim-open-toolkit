---
id: TKT-304
title: Generate Ara3D.StepTypes from the AP242 long form, with descriptors that address attributes in complex instances
status: done
depends_on: [TKT-302, TKT-303]
owner: session 10b9c9c6
session: 10b9c9c6-0052-40f3-a1c2-c12f2f8861d7
fence: [deps/bim-open-data/src/data/Ara3D.StepTypes/**, deps/bim-open-data/tools/Ara3D.IfcTypeGen/**, deps/bim-open-data/tests/data/**, deps.json]
workflow: [W3, W4]
confidence: high
created: 2026-10-17
claimed: 2026-10-17
closed: 2026-10-17
---

## Acceptance criteria

- [x] an explicit generator test writes Ara3D.StepTypes; a rerun on unchanged input is byte-identical
- [x] a test asserts attribute indices for ten Part 42 and 43 entities including the leading representation_item name
- [x] a descriptor reads an attribute of a partial entity inside a complex instance

Done in bim-open-data 337a762 (pin moved in deps.json): `StepCodeGenTest.TestGenerate` writes
`src/data/Ara3D.StepTypes`, byte-identical on rerun; `StepDescriptorTests` checks ten records from STEP-BREP-MODEL.md
section 3; `StepFileReadTests` reads the millimetre prefix of `#81=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))`
and a rational surface's weights from their complex instances in the u-blox SAM_AP214.STEP fixture. Ara3D.StepTypes.Tests
23 passed, Ara3D.IfcTypeGen 34 passed. Build log: docs/plans/step-reader.md, TKT-304 entry.

Plan: docs/plans/step-reader.md (reading STEP geometry in C# the way IFC is read: generated schema types from EXPRESS via Parakeet). Gaps 1 and 4.
