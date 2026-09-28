---
id: TKT-93
title: Sample flows give the right answer: the six wrong answers and five merges from the flow review
status: done
depends_on: []
owner:
fence: []
---

## Acceptance criteria

- [ ] bim-door-rooms, bim-room-containment, bim-param-quality, nrc-join-analytics, nrc-storey-carbon-chart and nrc-q6-analysis-run give the answers the review worked out, each checked against the data
- [ ] The review's five merges are done, or reported as unsafe with the reason, with every reference (paper walkthrough, tests, notebooks, docs) updated

Owner, 2026-09-28: 'go ahead with the wrong answers and merges'. Findings: the flow review of 2026-09-27.

## Outcome (2026-09-28)

Wrong answers fixed: 3ab6dbf (bim-door-rooms, bim-room-containment, bim-param-quality with a new optional groupBy on bim.paramCoverage), a54df19 (nrc-join-analytics), 604db6d (nrc-storey-carbon-chart), 3437d0b (nrc-q6-analysis-run), e33793e (nrc-q4-door-instances), 1a6d65c (nrc-q8-per-storey).
Merges: 6c2431f (mesh-volume into shared-color-legend), 100720c and 2bd07c7 (nrc-color-category and nrc-color-embodied-carbon into nrc-color-operational-carbon's valueColumn), 6d816ec (ifc-to-verdicts-and-chart into nrc-dc-w1-verdicts).
Not merged: nrc-element-psets into nrc-enrich-run. element-psets is the tables profile's only source of those rows, and enrich-run's sink.writePsets exists only in the bim profile; the real fix is a way for one graph to use another's output.
