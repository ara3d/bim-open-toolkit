---
id: TKT-61
title: Fix the SDK's stream-based BFast.Read seeking the wrong position for absolute ranges
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
---

## Acceptance criteria

- [ ] `BFast.Read` over a stream returns the same buffers as the memory-mapped reader for the 448-byte fixture used by `bfast.read`
- [ ] A test in `ara3d-sdk` covers an absolute range that does not start at zero
- [ ] The BFAST nodes can drop the memory-mapped workaround, or keep it with a reason

The bug is upstream in `ara3d-sdk`; recorded only in `docs/plans/flow-demos/PLAN.md:176` and `track-t.md`. The `bfast.read` and `bfast.buffer` nodes work around it with the memory-mapped reader. Raised by reviews/2026-09-27-status.md
