# 07 — Shared penetrations and equipment access coordination

Brief section 6, row "Shared penetrations and equipment access": F12
sections, F18 envelopes, F14 discipline views. Required input: "Registered
coordinates, participants and finding basis; candidate bounds overlap is
distinct from exact intersection."

## Input contract

| Table | Column | Type | Notes |
|---|---|---|---|
| `envelopes` | `objectId` | string | equipment clearance/access envelope |
| | `discipline` | string | e.g. `"Mechanical"`, `"Structural"` |
| | `bbox` | Observation of box | `{minX,minY,minZ,maxX,maxY,maxZ}` in a registered coordinate frame; `missing` if not registered |
| `penetrations` | `objectId` | string | a wall/slab opening |
| | `discipline` | string | e.g. `"Structural"` |
| | `bbox` | Observation of box | same shape as above |

Both tables share one registered coordinate frame (stated as an input
assumption of the fixture; a real adapter would check `CoordinateContext`
per F01/F04's coordinate-context concept before comparing boxes at all).

## Rules

The brief's constraint "candidate bounds overlap is distinct from exact
intersection" means: this workflow never claims a verified clash. It only
ever reports an axis-aligned bounding-box (AABB) overlap as a **candidate
finding**, with its basis stated as `"bounding-box-overlap"`.

1. **Coordinate gap** — an envelope or penetration with a `missing` `bbox`
   cannot be tested for overlap at all. It is reported as a coordination
   gap exception (reason from the observation, typically `not-provided`),
   never silently skipped and never treated as "no overlap."
2. **Candidate overlap test** — for every envelope/penetration pair where
   both have a known `bbox`, they overlap when their intervals intersect on
   all three axes: `envelope.minX <= penetration.maxX` and
   `penetration.minX <= envelope.maxX` (and the same for Y and Z). This is
   the standard AABB overlap test, computable by hand per axis.
3. Every overlapping pair becomes one **candidate finding** row, listing
   both participants, both disciplines, and `basis: "bounding-box-overlap"`.
   It is never labeled a "clash" or "verified intersection."
4. A penetration or envelope with a known `bbox` that overlaps nothing is
   not reported at all (no finding, no exception — it simply has no
   candidate).

## Worked example (prose)

Three envelopes, three penetrations, one coordinate gap:

- ENV-1 (Mechanical, box x:[0,2] y:[0,2] z:[0,2]).
- ENV-2 (Mechanical, box x:[10,12] y:[0,2] z:[0,2]) — far away, no overlap.
- ENV-3 (Structural, `bbox` missing, reason `not-provided`) — coordination
  gap.
- PEN-1 (Structural, box x:[1,3] y:[1,3] z:[0,2]) — overlaps ENV-1 on all
  three axes (x: [0,2]∩[1,3] → 1≤3 and 1≤2, yes; y and z similarly yes).
- PEN-2 (Structural, box x:[5,6] y:[0,2] z:[0,2]) — no overlap with either
  envelope (x ranges don't intersect any envelope).
- PEN-3 (Structural, box x:[1,2] y:[1,2] z:[5,6]) — overlaps ENV-1 on x and
  y but not z ([0,2] vs [5,6] don't intersect) → no overlap (all three axes
  must intersect).

Expected candidate findings: 1 — (ENV-1, PEN-1), basis
`bounding-box-overlap`.

Expected exceptions: 1 — ENV-3, coordination gap, reason `not-provided`.

ENV-2, PEN-2 and PEN-3 produce no rows at all (no overlap, no gap).

## Assumptions

- Both tables share one coordinate frame in this fixture; a real workflow
  would first check `CoordinateContext` compatibility and treat a frame
  mismatch as its own exception (out of scope here, noted for Track W).
- "Touching" boundaries (equal on an axis, e.g. `maxX == minX`) count as
  overlapping in this fixture's test (`<=`, not `<`); not exercised by the
  worked example's numbers, but stated so Track W's adapter matches.
