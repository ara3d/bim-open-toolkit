---
id: TKT-435
title: STEP mesher: types review of the Plato library, and staged prototypes of the best type changes (v1-types)
status: done
depends_on: []
owner:
fence: [docs/plans/step-mesher-types-review-2026-10-22.md, sandbox/step-mesh-staging/v1-types/**]
workflow: [W3]
related: [TKT-323, TKT-415, TKT-411, TKT-400]
created: 2026-10-22
closed: 2026-10-22
---

## Acceptance criteria

- [x] docs/plans/step-mesher-types-review-2026-10-22.md surveys layers 00 to 08 (10 and 11 briefly) with counts and file:line examples, ties defects to types, lists what Plato lacks, and ranks five to ten changes by defects prevented per hour
- [x] The top changes that fit a chunk are staged in sandbox/step-mesh-staging/v1-types with Law_V1Types_ laws passing and a TRACK.md with merge instructions
- [x] Changes that touch many call sites, and missing Plato features, are tickets

Asked by the STEP mesher supervisor session on 2026-10-22, beside the v1-reliability session (why defects slip past the laws). This one asks whether the types do enough.
