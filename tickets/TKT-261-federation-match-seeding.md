---
id: TKT-261
title: federation-match is skipped by the bim profile, has no golden, no answer view, and a 120-line SQL where table steps would read
status: done
depends_on: []
owner: builder-TKT-261
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [samples/snowdon-analyses/federation-match.json, samples/snowdon-analyses/README.md, src/studio/BimOpenFlow.Studio/BimSampleSeeding.cs, src/studio/BimOpenFlow.Studio/NrcSamples.cs, tests/studio/BimOpenFlow.SnowdonWorkflows.Tests/**, tests/studio/BimOpenFlow.Studio.Tests/NrcSeedingTests.cs, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/federation-match.txt]
workflow: [W2]
created: 2026-10-11
claimed: 2026-10-11
closed: 2026-10-11
kind: defect
---

## Acceptance criteria

- [x] The bim profile seeds federation-match green when the Snowdon model is present: {FEDERATION_UNION} resolves to a union the host prepares (as duplex-enriched.duckdb is) and the two CSV placeholders to committed files; or the README states it is test-only and the seeder lists it as such on purpose
- [x] A view.table named `answer` titled Storey correspondence sits between correspondence and write, so an opener sees a result before Run
- [x] storey-rule is split: duck.query for the storeys, sql.query for the window clustering only, table.derive/join/concat for the flags and the confirmations join; confirmations wires into t2; ids are camelCase; columns 330 px apart
- [x] The explanation in session.description moves to an about view.note; the README names federation-match.json, federation-confirmations.csv and SnowdonWorkflows.Tests, and its Converter facts section moves under docs/plans/

From the 2026-10-11 review. NrcSeedingTests.BimProfile_SeedsEveryNrcGraph asserts the log line 'skipped sample analysis federation-match'; the only evaluation is SnowdonWorkflows.Tests over a synthetic five-document union. The live host's copy fails with a pre-TKT-203 'source' port. The final node is the effect `write`, so the editor shows nothing until Run. Node and layout conventions for every sample pass: columns 330 px apart from x 40, rows 184 px (or 240 px when a card carries a long parameter), sources (value.path, duck.source) at x 40, an `about` view.note at (40, 40) with the first row below it and a stored width 560 and a height that fits its text (the canvas shows at most 12 lines of a 300 px note); the final node is named `answer` and carries only readable columns (names, levels, measures with units; ids last or dropped); every reader whose `path` is a socket takes its path from one value.path or duck.source node, and a graph a user would run on their own model declares a graph input `model` whose value.path holds `$model` (bim-discipline-mix and deps/bim-open-flow/samples/buildings/schependomlaan-spaces-per-storey are the references); table.sort uses A/descendingA (the `by` list is the legacy form). Re-approve the folder's goldens with SAMPLE_FLOWS_APPROVE=1 and check the README numbers still hold.
