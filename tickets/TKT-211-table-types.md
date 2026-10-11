---
id: TKT-211
title: Table types: named AEC table classes with structural conformance, typed ports, a palette grouped by domain, and next-node suggestions
status: open
depends_on: [TKT-206, TKT-209]
owner:
fence: []
workflow: [W2]
related: [TKT-4]
created: 2026-10-11
---

## Acceptance criteria

- [ ] A `TableType` registry beside the column kinds (TKT-206): a name (Element, Door, Wall, Room, Storey, Parameter, Relation, Bounds, Issue, Verdict, ...), the required column kinds, the optional ones, and the key; a table conforms to a type structurally, by having the required columns with compatible types, so a join's output still conforms to every type its columns satisfy
- [ ] A Table port may declare the type it expects (`PortSpec.TableType`), and the schema pass (TKT-209) warns when the wired table does not conform, naming the missing columns
- [ ] The node palette groups the domain nodes by table type (Doors, Walls, Rooms, Storeys, Schedules, Issues) above the generic packs, and the catalog carries the grouping
- [ ] Selecting a node offers "next" nodes: those whose first Table input the selected output conforms to, ranked by the number of required columns matched, so a Door table offers rooms-per-door, a door schedule and a 3D colouring, and never a date filter first
- [ ] `docs/types.md` is generated: each type, its columns with meaning, and the nodes that produce and consume it

Source: `docs/plans/declared-schemas.md` and the owner's observation that a known table is a class, columns are its properties, and the user works inside a domain of such classes and should explore it rather than guess. The first set of nouns is TKT-213's question.
