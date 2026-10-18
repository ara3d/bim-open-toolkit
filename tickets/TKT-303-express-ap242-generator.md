---
id: TKT-303
title: ExpressGrammar and the schema-type generator cover AP242 EXPRESS: ANDOR supertypes, several supertypes, extensible selects
status: done
depends_on: [TKT-301]
owner: session 10b9c9c6
session: 10b9c9c6-0052-40f3-a1c2-c12f2f8861d7
fence: [deps/parakeet/Parakeet.Grammars/ExpressGrammar.cs, deps/parakeet/input/exp/**, deps/parakeet/Parakeet.Tests/**, deps/bim-open-data/tools/Ara3D.IfcTypeGen/**, deps.json]
workflow: [W3, W4]
confidence: high
created: 2026-10-17
claimed: 2026-10-17
closed: 2026-10-17
---

## Acceptance criteria

- [x] every ENTITY and TYPE block in the AP242 long form parses
- [x] attribute indices are computed over all supertypes in EXPRESS order, not from the first supertype only
- [x] regenerating Ara3D.IfcTypes gives byte-identical output
- [x] the deps.json pins for parakeet and bim-open-data move to the pushed commits

Plan: docs/plans/step-reader.md (reading STEP geometry in C# the way IFC is read: generated schema types from EXPRESS via Parakeet). Gap 2. The AP242 schema file goes beside the IFC ones in deps/parakeet/input/exp if its terms allow.

## Outcome

- parakeet 278d154: `ExpressGrammar` reads every ENTITY and TYPE block of AP242 ed3, AP214 ed3, AP203 ed2, IFC2X3, IFC4 and IFC4X3 with no recorded parse error (`ParserState.LastError`; before, 697 AP242 entities were read only in part although `AtEnd` held). `Parakeet.Tests/ExpressGrammarTests.cs`.
- bim-open-data edb944a: the generator's model keeps every supertype; `ExpressAttributeLayout.Layout` computes Part 21 positions over the whole supertype graph (simple instance `Position`, partial-entity `OwnPosition`, `IsDerived` for `*`). `StepSchemaLayoutTests` checks 26 AP242 records against `sandbox/step-brep-mesh/research/STEP-BREP-MODEL.md` section 3: 33 tests pass. `TestGenerate` output is byte-identical. The parakeet pin in `deps/bim-open-data/deps.json` moved to 278d154; the toolkit's bim-open-data pin to edb944a.
- The schemas stay in the git-ignored `deps/bim-open-data/data/express/`, not `deps/parakeet/input/exp`: their source states no licence.
- Extensible and `BASED_ON` selects do not occur in the three long forms, so the grammar has no rule for them.
