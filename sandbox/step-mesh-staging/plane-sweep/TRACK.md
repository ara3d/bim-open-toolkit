# plane-sweep: measure a sweep-line (monotone) triangulation of plane faces against the CDT seed

Ticket: TKT-495
Status: done: measured, not landed (negative verdict); no chunk to merge

## Done
- PS1 measurement, commits on 2026-10-23: the C# prototype (`prototype/`) and per-face results (`results/`); verdict
  in `docs/plans/step-mesher-plane-sweep-2026-10-22.md`. No Plato written, no law verdict changed.

## Merge instructions
- None: nothing to wire.

## Contract requests
- None.

## Requests to other tracks
- None.

## Findings
- At bim-open-data `2a74c53b` (TKT-505's `--loops`) the CDT on TOBY-L4 face 1011 (249 loops) is 19.8 ms, down from
  747 ms at `1093b2e6`; the heavy planes now cost their region step (176 of 213 ms on that face) and work outside
  the named stages of MeshFace, not the triangulator.
- The raw sweep makes flat triangles on collinear boundary runs (153 in 62 of 1,959 faces); `DelaunayedIndexed`
  after it removes them all, at 84 of its 98 ms.
- The prototype refuses coincident points, a vertex on a side and point holes, so 6 copy laws and the LARA pads
  witness law fail; 19 of 1,978 corpus faces were refused.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Read the stopped state, ticket, seed laws | 6 min | - |
| Prototype: repeated timings, seed time, post-flip checks; build | 3 min | 1 build (52 s) |
| Measurement, 9 files | 2 min | 9 runs |
| Verdict document, track file, commits | 10 min | - |

## Lessons
- The first measurement ran on a pin a day old; a pin move (TKT-505) changed the answer by an order of magnitude.
  Rebuild against the current pin before measuring.
