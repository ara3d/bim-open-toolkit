---
id: TKT-264
title: checking-analyses pass: one value.path per graph as a model input, answer nodes, notes, table steps instead of SQL, the topics port
status: done
depends_on: [TKT-258]
owner:
fence: [samples/checking-analyses/**, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/check-*.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/bcf-*.txt, tests/studio/BimOpenFlow.NrcWorkflows.Tests/CheckingGraphTests.cs, tests/studio/BimOpenFlow.NrcWorkflows.Tests/IdsFilesTests.cs]
workflow: [W3]
created: 2026-10-11
closed: 2026-10-12
---

## Acceptance criteria

- [ ] Each graph that reads the Duplex holds its path once in a value.path `modelPath` (the .bos, also for scene nodes, which accept .bos) promoted to a graph input `model`; check-ids-door-width no longer loads the building twice; bcf-from-ids-failures and bcf-from-sql no longer type the path into both model.path and bcf.model
- [ ] Every graph ends in a node named `answer` and has an about view.note (door-width: DC-W1 as IDS, same 8/6 as nrc-dc-w1-verdicts; from-ids-failures: topics is the preview of the file Run writes; read-colour: it reads the committed bcf, not the written one; specifications: no model is read)
- [ ] bcf-from-sql's doors query becomes table.filter, table.filter, table.join, table.derive, table.project, table.sort; bcf-read-colour shows bcf.read's topics port in a view.table and drops the perTopic aggregate
- [ ] check-ids-carbon-psets: a view.table titled Failing elements (GlobalId, CheckId, Reason), chart labels by CheckTitle, valueColumns Pass, Fail, InfoNotAvailable; check-ids-specifications: a titled view.table after each card
- [ ] Goldens approved for all six; CheckingGraphTests numbers hold

From the 2026-10-11 review of samples/checking-analyses (6 graphs). All six hold {SAMPLES}/duplex-enriched.bos or .ifc as a literal, none declares an input, none has a note, none has an answer node; layout is already on the 330 x 260 grid. Depends on the goldens ticket for SampleSourceFiles.Dirs. Node and layout conventions for every sample pass: columns 330 px apart from x 40, rows 184 px (or 240 px when a card carries a long parameter), sources (value.path, duck.source) at x 40, an `about` view.note at (40, 40) with the first row below it and a stored width 560 and a height that fits its text (the canvas shows at most 12 lines of a 300 px note); the final node is named `answer` and carries only readable columns (names, levels, measures with units; ids last or dropped); every reader whose `path` is a socket takes its path from one value.path or duck.source node, and a graph a user would run on their own model declares a graph input `model` whose value.path holds `$model` (bim-discipline-mix and deps/bim-open-flow/samples/buildings/schependomlaan-spaces-per-storey are the references); table.sort uses A/descendingA (the `by` list is the legacy form). Re-approve the folder's goldens with SAMPLE_FLOWS_APPROVE=1 and check the README numbers still hold.

Closed 2026-10-12 by the supervisor after commit 7597288e. Deviation from criterion 1: view3d.instances reads IFC only (it throws "Expected 'ISO-10303-21'" on a .bos), so check-ids-door-width keeps a second input `geometry` for the IFC and bcf-read-colour's `model` input defaults to the IFC. The pack defect is TKT-280.
