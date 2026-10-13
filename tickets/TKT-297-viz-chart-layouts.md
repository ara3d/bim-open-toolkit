---
id: TKT-297
title: Five viz-analyses graphs that show chart.bar's layout and colorBy and the multi-series chart.line in AEC workflows
status: open
depends_on: []
owner:
fence: [samples/viz-analyses/**, tests/studio/BimOpenFlow.SampleFlows.Tests/golden/bim/viz-*.txt, bimopenflow/web/packages/studio-web/src/templates.generated.ts]
workflow: [W3, W1]
related: [TKT-294, TKT-268, TKT-234]
confidence: high
created: 2026-10-12
---

## Acceptance criteria

- [ ] Five new graphs under samples/viz-analyses, each with a role, a question, an about note, a specs/<id>.vl.json, and a README row: a horizontal ranked takeoff coloured per category and shared with the 3D view, a stacked build-up by material (series colours), grouped declared-against-measured volumes (series colours), a single-accent horizontal schedule (colorBy none), and a multi-series chart.line of cumulative progress with a stacked weekly bar
- [ ] Between them the chart nodes use every layout (vertical, horizontal, stacked), every colorBy (category, series, none, and the scale input), sort, and chart.line with several yColumns; viz-storey-stacking's per-class chart is set to layout stacked and colorBy series, as its spec already draws
- [ ] VizSampleAnalysesTests and the SampleFlows goldens pass with the new goldens approved; the README's numbers section records what each graph computes for the Duplex; templates.generated.ts is regenerated; the sample layout gates pass

Asked by the owner on 2026-10-12: more sample graphs that demonstrate the charting capabilities TKT-294 gave chart.bar (layout, colorBy, Vega-Lite rendering with the family palette) in realistic AEC workflows. None of the toolkit's 14 viz-analyses graphs set layout or colorBy; only bim-open-flow's six buildings graphs do. The new graphs read the Duplex in samples/nrc as the existing ones do and follow the conventions of TKT-268 (about note at 40,40 with width 560; sources at x 40; positions from relayout-samples; final node answer). Mirrors on bim-open-plot's demo page (its flow-* demos) are that repository's follow-through, not this ticket's.
