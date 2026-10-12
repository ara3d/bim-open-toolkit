---
id: TKT-266
title: view3d-analyses pass: a model input and a note per graph, the wall filter, touching boxes, and the shared scale that clamps
status: done
depends_on: []
owner: builder-TKT-266
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [samples/view3d-analyses/**, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/clash-candidates.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/color-by-category.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/decimate-overview.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/explode-categories.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/ghost-context.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/massing-boxes.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/shared-color-legend.txt, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/voxel-density.txt, tests/flow/BimOpenFlow.View3dWorkflows.Tests/View3dSampleTests.cs]
workflow: [W3]
created: 2026-10-11
claimed: 2026-10-11
closed: 2026-10-11
---

## Acceptance criteria

- [x] shared-color-legend's scale no longer clamps 80 of 714 instances (auto, or max 61 for the roof's 60.75 m3) and the golden carries no out-of-domain warning; the chart labels bars by category and entity id, not 11 bars named IFCSPACE; model becomes a graph input and the readers' stale literals are blank; the chart chain sits level at y 408
- [x] ghost-context keeps IFCWALL as well as IFCWALLSTANDARDCASE opaque; clash-candidates drops pairs with OverlapVolume 0 and excludes IFCSPACE and IFCOPENINGELEMENT from the self-join
- [x] color-by-category folds 14 categories to at most 10 colour groups (spaces and openings out) and shows the per-category count; explode-categories uses view3d.arrange so the first frame fits; massing-boxes colours boxes by label; ids vox and big become voxels and largest
- [x] Every graph declares a `model` input (default {SAMPLES}/duplex-base.ifc) on the reader's path and has an about note; README's 'validates against the Bos + Geometry packs' sentence lists the packs View3dSampleTests uses; goldens re-approved

From the 2026-10-11 review of samples/view3d-analyses (8 graphs, all green). The flagship shared-color-legend fixes its domain to 0..1 m3, so every chart bar takes the end colour and the golden warns '20 of 20 bars lie outside the domain'. Node and layout conventions for every sample pass: columns 330 px apart from x 40, rows 184 px (or 240 px when a card carries a long parameter), sources (value.path, duck.source) at x 40, an `about` view.note at (40, 40) with the first row below it and a stored width 560 and a height that fits its text (the canvas shows at most 12 lines of a 300 px note); the final node is named `answer` and carries only readable columns (names, levels, measures with units; ids last or dropped); every reader whose `path` is a socket takes its path from one value.path or duck.source node, and a graph a user would run on their own model declares a graph input `model` whose value.path holds `$model` (bim-discipline-mix and deps/bim-open-flow/samples/buildings/schependomlaan-spaces-per-storey are the references); table.sort uses A/descendingA (the `by` list is the legacy form). Re-approve the folder's goldens with SAMPLE_FLOWS_APPROVE=1 and check the README numbers still hold.
