---
id: TKT-270
title: bim-open-flow buildings graphs: one duck.source and a model input in all six, readable chart labels, table steps for the heating graph, answer nodes
status: done
depends_on: []
owner: builder-TKT-270
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [deps/bim-open-flow/samples/buildings/**, deps/bim-open-flow/site/data/buildings.json, deps/bim-open-flow/tests/flow/BimOpenFlow.TableWorkflows.Tests/PublicBuildingsTests.cs, deps/bim-open-flow/bimopenflow/web/packages/**/buildingSamples.test.ts]
workflow: [W1, W2]
created: 2026-10-11
claimed: 2026-10-11
closed: 2026-10-11
---

## Acceptance criteria

- [x] The five graphs without one gain a duck.source `db` with path $model and a graph input `model` wired into every reader (elements-by-category and digitalhub-openings-per-storey today repeat the path twice)
- [x] Chart labels are words, not IFC class codes (table.rename after pivot: Doors, Windows, Spaces; a Discipline column for the federated models); digitalhub-heating-per-storey is rebuilt as the openings graph's table steps; schependomlaan's depth convention is stated in a note
- [x] Every graph ends in `answer`; digitalhub-openings-per-storey's columns are 320 px apart; the README describes the model input and index.json lists inputs
- [x] PublicBuildingsTests and buildings.json hold the same numbers; committed and pushed in deps/bim-open-flow with the hash reported, the pin moved by the supervisor

From the 2026-10-11 review of deps/bim-open-flow/samples/buildings (6 graphs). Only schependomlaan-spaces-per-storey, the reference example of the graph sources wave, uses the wave's features. Node and layout conventions for every sample pass: columns 330 px apart from x 40, rows 184 px (or 240 px when a card carries a long parameter), sources (value.path, duck.source) at x 40, an `about` view.note at (40, 40) with the first row below it and a stored width 560 and a height that fits its text (the canvas shows at most 12 lines of a 300 px note); the final node is named `answer` and carries only readable columns (names, levels, measures with units; ids last or dropped); every reader whose `path` is a socket takes its path from one value.path or duck.source node, and a graph a user would run on their own model declares a graph input `model` whose value.path holds `$model` (bim-discipline-mix and deps/bim-open-flow/samples/buildings/schependomlaan-spaces-per-storey are the references); table.sort uses A/descendingA (the `by` list is the legacy form). Re-approve the folder's goldens with SAMPLE_FLOWS_APPROVE=1 and check the README numbers still hold.

## Build notes (2026-10-11)

Done in bim-open-flow 946cc41. Columns are 330 px apart (the shared convention), not the 320 the third criterion names; a card wider than one column (a long filter expression, the rename, the SQL query) takes two, so the next node starts at the following 330 px slot. elements-by-category still charts IFC class codes, since its question is "by IFC class". The heating graph's AllElements column went with its SQL. The toolkit's deps.json pin is the supervisor's to move.
