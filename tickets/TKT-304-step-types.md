---
id: TKT-304
title: Generate Ara3D.StepTypes from the AP242 long form, with descriptors that address attributes in complex instances
status: open
depends_on: [TKT-302, TKT-303]
owner:
fence: [deps/bim-open-data/src/data/Ara3D.StepTypes/**, deps/bim-open-data/tools/Ara3D.IfcTypeGen/**, deps/bim-open-data/tests/data/**, deps.json]
workflow: [W3, W4]
confidence: high
created: 2026-10-17
---

## Acceptance criteria

- [ ] an explicit generator test writes Ara3D.StepTypes; a rerun on unchanged input is byte-identical
- [ ] a test asserts attribute indices for ten Part 42 and 43 entities including the leading representation_item name
- [ ] a descriptor reads an attribute of a partial entity inside a complex instance

Plan: docs/plans/step-reader.md (reading STEP geometry in C# the way IFC is read: generated schema types from EXPRESS via Parakeet). Gaps 1 and 4.
