---
id: TKT-312
title: Decode a parsed STEP file into the Plato library's BrepModel through the generated AP242 types (C#), replacing layer 3's DecodeBrep
status: open
depends_on: [TKT-311]
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Step.Mesher/Decode/**, deps/bim-open-data/tests/data/Ara3D.Step.Mesher.Tests/Decode/**, deps.json]
workflow: [W3, W4]
related: [TKT-299, TKT-304, TKT-305]
confidence: high
created: 2026-10-17
---

## Acceptance criteria

- [ ] the unit cube and two-cube assembly fixtures decode to BrepModel values equal to the Plato library's witnesses for them
- [ ] the decoded model passes the Plato library's model checks (the topology and geometry invariants it declares for a decoded model), run from C#
- [ ] decoding reads only through Ara3D.StepTypes descriptors; every entity it cannot represent is a diagnostic, never an exception
- [ ] all 88 files of the u-blox library decode with zero exceptions; counts of faces decoded and entities not represented are in the build log

Plan: docs/plans/step-reader.md, section 'Pivot: geometry in Plato' (owner decision 2026-10-17). The boundary between C# and Plato moves from Part21File to BrepModel (and the occurrences DecodeBrep would have produced), so decoding happens in compiler-checked generated C# rather than by string name in Plato (finding F-1). The exact input type and the witnesses come from the Plato session after it revises layer 3.
