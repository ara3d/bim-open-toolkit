---
id: TKT-257
title: Dragging a node in a seeded sample marks the copy as edited for good, so a changed sample is never refreshed and the stale copy stays red
status: done
depends_on: []
owner: builder-TKT-257
session: 747367c7-cc40-452c-911b-37ed983339cb
fence: [deps/bim-open-flow/src/flow/BimOpenFlow.Host/SampleSeeding.cs, deps/bim-open-flow/src/flow/BimOpenFlow.Host/SampleSeedRecord.cs, deps/bim-open-flow/tests/**/SampleSeeding*, deps/bim-open-flow/scripts/seed-store.mjs]
workflow: [W1, W2]
related: [TKT-118]
created: 2026-10-11
claimed: 2026-10-11
closed: 2026-10-12
kind: defect
---

## Acceptance criteria

- [x] The seed record hashes structure and values only, so a copy whose only difference from the seeded sample is layout (positions, sizes) still counts as untouched and is refreshed when the sample changes
- [x] A refresh of such a copy keeps the user's node positions for nodes that still exist and lays out new nodes beside them
- [x] A test seeds a sample, moves one node, changes the sample on disk, reseeds, and sees the new structure with the moved node where the user left it
- [ ] The stale bfast-buffers copy in a store seeded before 2026-10-11 refreshes on the next host start without deleting it by hand

Seen 2026-10-11: http://localhost:5300/?analysis=bfast-buffers showed the four-node graph from before TKT-138 (two literal paths, both FileNotFoundException, the stored path still pointing at samples/nrc/../tables/sample.bfast) although samples/showcase-tables/bfast-buffers.json has the shared value.path node and the golden text is green. The host log says: kept your edited copy of sample analysis bfast-buffers. The only edit was a drag of the values node (its x became 619.89). SampleSeedRecord.Hash covers the whole canonical document, layout included, so any drag turns a sample copy into a kept one for good, and the user sees a red graph with no notice (the notice is TKT-118).

Found 2026-10-12 (builder): the store the ticket describes, `artifacts/bim-flow/bim/store`, records bfast-buffers as `"sha256": ""` (a pre-record store whose copy already had versions), and the copy is not layout-only: version 0003 (2026-09-27) changed the `prices` node's `type` from float64 to int16, a value no sample ever held, and the current copy still has it. The seeder now takes the oldest saved version as the seed for an empty hash and compares structure and values, so a copy that was only dragged refreshes; this one is a real edit and is kept, as the edited-copy rule requires. The fourth criterion as written would need the seeder to overwrite a value edit. Decide: accept "kept" here and rely on TKT-118 (the notice) for this copy, or delete it by hand once.

Closed 2026-10-12 by the supervisor after bim-open-flow 665186a and toolkit e296c1eb. Criteria 1 to 3 are met. Criterion 4 does not apply as written: the stale copy in artifacts/bim-flow/bim/store carried a real value edit from 2026-09-27 (the prices node's type set to int16), so keeping it is the right behaviour; the demo store was recreated instead.
