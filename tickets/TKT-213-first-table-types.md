---
id: TKT-213
title: Which AEC nouns are the first table types, which columns does each require, and is conformance structural or nominal?
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
related: [TKT-211, TKT-212]
created: 2026-10-11
kind: question
---

Which AEC nouns are the first table types, and which columns does each require? The owner named doors, walls, schedules, floor plans and issues (2026-10-11); the packs already produce elements, rooms, levels, bounds, parameters, containment, door edges, verdicts.

Decisions needed:

1. The first set of types and, for each, the required columns and the key. Recommendation: Element, Door, Wall, Window, Space, Storey, Parameter, Bounds, Issue, Verdict; key `EntityIndex` within one model, `GlobalId` across models.
2. Structural or nominal conformance. Recommendation: structural, so a join's output keeps every type its columns satisfy; a name is a label on a column set, not a brand.
3. Where a floor plan fits: a table type (elements with a storey and a footprint) or a view (a 2D rendering of one). Recommendation: a view over the Element type filtered by storey, not a type of its own.
4. Whether the parameter table is wide (one column per property, `bim.schedule`) or long (`ParameterText`). Recommendation: both exist, and the type registry names them `Schedule` and `Parameter`.

Raised by `docs/plans/declared-schemas.md`. TKT-211 and TKT-212 build on the answer; TKT-206 to TKT-210 do not wait for it.

Note 2026-10-12 (declared-schemas coordinator): waves A to C are done (TKT-206 to TKT-210 closed; see the build log in `docs/plans/declared-schemas.md`). The column kind registry, declared and inferred schemas on every `table.*`, SQL, reader, `bim.*`, `bos.*`, `ids.*`, `bcf.*` and most `check.*` node, the static schema pass with warnings, and schema-driven pickers are in place. TKT-211 (table types) and TKT-212 (domain pack) are ready to start as soon as this question is answered; nothing else blocks them. Two smaller decisions surfaced on the way and are filed separately: TKT-241 (view3d column casing) and TKT-283 (the outputs still undeclared).
