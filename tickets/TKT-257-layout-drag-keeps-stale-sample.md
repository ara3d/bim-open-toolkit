---
id: TKT-257
title: Dragging a node in a seeded sample marks the copy as edited for good, so a changed sample is never refreshed and the stale copy stays red
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/src/flow/BimOpenFlow.Host/SampleSeeding.cs, deps/bim-open-flow/src/flow/BimOpenFlow.Host/SampleSeedRecord.cs, deps/bim-open-flow/tests/**/SampleSeeding*, deps/bim-open-flow/scripts/seed-store.mjs]
workflow: [W1, W2]
related: [TKT-118]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] The seed record hashes structure and values only, so a copy whose only difference from the seeded sample is layout (positions, sizes) still counts as untouched and is refreshed when the sample changes
- [ ] A refresh of such a copy keeps the user's node positions for nodes that still exist and lays out new nodes beside them
- [ ] A test seeds a sample, moves one node, changes the sample on disk, reseeds, and sees the new structure with the moved node where the user left it
- [ ] The stale bfast-buffers copy in a store seeded before 2026-10-11 refreshes on the next host start without deleting it by hand

Seen 2026-10-11: http://localhost:5300/?analysis=bfast-buffers showed the four-node graph from before TKT-138 (two literal paths, both FileNotFoundException, the stored path still pointing at samples/nrc/../tables/sample.bfast) although samples/showcase-tables/bfast-buffers.json has the shared value.path node and the golden text is green. The host log says: kept your edited copy of sample analysis bfast-buffers. The only edit was a drag of the values node (its x became 619.89). SampleSeedRecord.Hash covers the whole canonical document, layout included, so any drag turns a sample copy into a kept one for good, and the user sees a red graph with no notice (the notice is TKT-118).
