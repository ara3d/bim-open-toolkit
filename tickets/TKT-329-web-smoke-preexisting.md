---
id: TKT-329
title: Web smoke gate fails before TKT-320: nrc-rollup wire behind a card, nrc-web notebook card positions and README text drifted, a TableSlice type error in its samples test
status: claimed
depends_on: []
owner: session e2aa2b2c
session: e2aa2b2c-7acb-41a8-96ea-ad30e584b1f4
fence: [samples/nrc-analyses/nrc-rollup.json, bimopenflow/web/packages/nrc-web/test/**, samples/notebooks/**, samples/nrc-analyses/README.md]
workflow: [W3]
created: 2026-10-18
claimed: 2026-10-18
kind: defect
---

## Acceptance criteria

- [ ] test/sampleLayout.test.ts in studio-web passes: nrc-rollup.json has no wire behind a card (relay out with the layout tool)
- [ ] nrc-web test/nrcCatalog.test.ts and test/samples.test.ts pass against the current README and notebook files, and its typecheck passes (test/samples.test.ts line 47 assigns TableSlice | undefined to TableSlice)
- [ ] node gates/web-smoke.mjs prints WEB SMOKE: PASS

Found 2026-10-18 while running the web smoke gate for TKT-320 (the bidirectional viewer). None of the failures touch files that ticket changed: nrc-rollup.json was last changed on 2026-10-11, the nrc-web tests on 2026-10-11, and the README text the catalog test expects ('total operational carbon and element count') was reworded by the nrc-analyses passes. The gate's report is piped through tail in gates/web-smoke.mjs callers; run the four toolkit steps by hand to see each failure.

## Notes

- 2026-10-18: the layout tool (`relayout-samples` over samples/nrc-analyses) rewrote nrc-rollup.json and nrc-enrich-run.json but left the faults (1 and 10 wires behind cards); the rewrite was discarded. A hand move or a graph change (an extra column, a reordered row) is needed, not a rerun of the tool.
- 2026-10-18: taken over by session e2aa2b2c from session c4298a2b (its agent stopped at a usage limit); its uncommitted edits to three notebooks and two nrc-web tests are kept as the starting point of the regeneration for TKT-320 and TKT-336.
