---
id: TKT-130
title: bim.storeyOf: one row per element with its nearest containing storey
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
---

## Acceptance criteria

- [ ] One row per element (EntityIndex, GlobalId, StoreyIndex, StoreyName, StoreyStepId); the smallest containment depth wins; an element with no storey gets nulls
- [ ] Never more than one row per element, so a sum over it cannot double count
- [ ] The storey half of the containers rel.sql in nrc-rollup, nrc-enrich-run, and nb-s05-write-back-storey-psets, and storeyOfMin in nrc-join-analytics, use it with answers unchanged

Source: node review of 2026-09-29. Four copies of QUALIFY row_number() OVER (PARTITION BY EntityIndex ORDER BY Depth) = 1 over StoreyOfElement; the double count agents hit through StoreyOfEntity is the risk it removes.
