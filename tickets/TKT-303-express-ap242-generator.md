---
id: TKT-303
title: ExpressGrammar and the schema-type generator cover AP242 EXPRESS: ANDOR supertypes, several supertypes, extensible selects
status: open
depends_on: [TKT-301]
owner:
fence: [deps/parakeet/Parakeet.Grammars/ExpressGrammar.cs, deps/parakeet/input/exp/**, deps/parakeet/Parakeet.Tests/**, deps/bim-open-data/tools/Ara3D.IfcTypeGen/**, deps.json]
workflow: [W3, W4]
confidence: high
created: 2026-10-17
---

## Acceptance criteria

- [ ] every ENTITY and TYPE block in the AP242 long form parses
- [ ] attribute indices are computed over all supertypes in EXPRESS order, not from the first supertype only
- [ ] regenerating Ara3D.IfcTypes gives byte-identical output
- [ ] the deps.json pins for parakeet and bim-open-data move to the pushed commits

Plan: docs/plans/step-reader.md (reading STEP geometry in C# the way IFC is read: generated schema types from EXPRESS via Parakeet). Gap 2. The AP242 schema file goes beside the IFC ones in deps/parakeet/input/exp if its terms allow.
