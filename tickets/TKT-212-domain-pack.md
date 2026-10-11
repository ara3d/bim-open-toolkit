---
id: TKT-212
title: A domain pack generated from table types and BOS views: bim.doors, bim.walls, bim.storeys, bim.schedule and the rest, with declared schemas
status: open
depends_on: [TKT-211, TKT-202]
owner:
fence: []
workflow: [W2, W5]
related: [TKT-129]
created: 2026-10-11
---

## Acceptance criteria

- [ ] One domain node per table type in TKT-213's first set, each taking a model source (TKT-202's Database value or a `.bos` path until TKT-203 lands) and producing a statically declared table: `bim.doors`, `bim.walls`, `bim.windows`, `bim.spaces` (or `bim.rooms` extended), `bim.storeys` (`bim.levels` extended), `bim.issues` from a check, and a `bim.schedule` that takes a type and the property columns to add (TKT-129's `bim.property`, generalized)
- [ ] The nodes are generated from one declaration file (type, BOS view or SQL, column kinds), not written by hand one at a time; the same generator can emit a pack for another known schema (IDS verdicts, BCF issues, a COBie sheet)
- [ ] `bim.elements`, `bim.rooms`, `bim.levels`, `bim.bounds`, `bim.paramTable`, `bim.containment`, `bim.nearest` and `bim.hops` declare their static schemas from the registry (TKT-206, TKT-207)
- [ ] The Schependomlaan storeys sample graph is rebuilt as `bim.elements` (or `bim.storeys`) into `table.aggregate` with no hand join, with the same numbers; the sample README shows both versions
- [ ] Claude builds a door schedule per storey from the catalog alone, with every column picked from a declared schema, in the committed benchmark transcript

Source: `docs/plans/declared-schemas.md`. The pack is where the user meets the domain: doors, walls, rooms, storeys, schedules, issues, instead of `EntityText` joined to `StoreyOfElement` by hand.
