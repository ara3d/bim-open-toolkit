# STEP mesher: a sweep-line triangulation of plane faces against the CDT seed (TKT-495)

Measured 2026-10-23. TKT-495 asked whether an O(B log B) sweep-line triangulation (monotone decomposition, de Berg et
al. chapter 3, holes handled without bridges) makes plane faces several times faster than `TriangulateRegionCdt`, the
constrained Delaunay triangulation (CDT), without breaking a contract.

**Verdict: it does not land.** At the current library pin the CDT is 22% of plane face time, so even a free
triangulator cannot make plane faces several times faster. Over 1,978 plane faces in 9 files, replacing the seed by
the sweep plus the same Delaunay flips would cut plane face time from 2,104 ms to about 1,780 ms (1.18 times). The
raw sweep also leaves slivers that fail the contract's degenerate measure, and it refuses the weakly simple regions
the E4 and E5 seed laws require it to triangulate. The ticket's premise, seconds per heavy plane, was true at the
older pin and is gone: TKT-505's loop lowering made the CDT on TOBY-L4's 249-loop face 38 times faster.

## What was measured

- **Program**: `sandbox/step-mesh-staging/plane-sweep/prototype/` (C#, throwaway). For every plane face meshed by
  triangles, it times the plane path's stages and then, on the same chart points and next table, the CDT
  (`TriangulateRegionCdt`), its seed alone (`CdtSeedOfRegionOverCopies`, the insertion seed of E4 and E5a'), the sweep,
  and `DelaunayedIndexed` run on the sweep's triangles. Each of those four is the best of three runs, in the same
  process, back to back. Each JIT is warmed by a first pass over every face.
- **Checks per triangulation**: the layer 5 gate (every boundary segment a side once in its direction, every other
  side shared by two triangles opposite ways, every triangle positive, the count n + 2h - 2, areas summing to the
  region's within 1e-9), the minimum angle, and the slivers under the harness's measure (2 area / longest side^2 at
  or below 1e-9, bim-open-data `dee6ce4`; a sliver counts as degenerate, and none of these faces carries FACE-ZERO-WIDTH
  or FACE-CUSP, so none would be excused).
- **Library**: `Ara3D.StepBrep` at bim-open-data `2a74c53b` (generated from Plato `6ff8c4a7` with `--loops`, the
  current pin). The previous builder's first run, kept in `plane-sweep/results/old-pin-1093b2e6/`, used `1093b2e6`, the
  library of the late 2026-10-22 corpus run.
- **Files**: the four with the heaviest plane faces in the late corpus run (TOBY-L4, MPCI, LEXI, LARA), M2-ZED-F9T-20B-00
  (many 264-point faces), and four ordinary files (NEO, BMD-380, IRIS-W1x1, EMMY-W1). Per-face rows are in
  `sandbox/step-mesh-staging/plane-sweep/results/*.csv`.

## The cost has moved

The same faces at the two pins (one face each; milliseconds):

| Face | Loops | Points | Pin | Region | CDT | MeshFace |
|---|---|---|---|---|---|---|
| TOBY-L4 1011 | 249 | 1,020 | `1093b2e6` | 3,085 | 747 | 6,967 |
| TOBY-L4 1011 | 249 | 1,020 | `2a74c53b` | 176 | 19.8 | 213 |
| LARA 742 | 101 | 404 | `1093b2e6` | 181 | 13.0 | 266 |
| LARA 742 | 101 | 404 | `2a74c53b` | 30 | 9.4 | 47 |

At `2a74c53b`, the region step (`UnorientedRegionOfIn` and `OrientRegion`) is the largest named stage: 590 ms of the
2,104 ms plane face time below, 176 ms of TOBY-L4 1011's 213 ms. The CDT is 453 ms, of which the seed is 362 ms.

## Per file

Plane faces meshed by triangles; times summed over the file's faces, in milliseconds. "Sweep + flips" is the sweep
followed by `DelaunayedIndexed`, which is how the sweep would replace the seed. A fallback is a face the sweep
refused, which would pay for the CDT as well.

| File | Faces | MeshFace | Region | CDT (seed) | Sweep | Sweep + flips | Fallbacks | Raw sweep slivers (faces) | Slivers after flips | CDT slivers |
|---|---|---|---|---|---|---|---|---|---|---|
| TOBY-L4 | 270 | 380 | 207 | 58.5 (46.7) | 1.6 | 13.8 | 2 | 74 (8) | 0 | 0 |
| MPCI | 444 | 409 | 116 | 79.1 (60.7) | 1.8 | 14.8 | 4 | 12 (7) | 0 | 0 |
| LEXI | 185 | 327 | 75 | 62.3 (52.4) | 1.4 | 9.9 | 2 | 0 (0) | 0 | 0 |
| LARA | 296 | 254 | 70 | 57.6 (43.5) | 2.3 | 10.5 | 5 | 27 (18) | 0 | 0 |
| M2-ZED-F9T-20B-00 | 293 | 320 | 63 | 78.1 (63.8) | 1.7 | 20.3 | 5 | 25 (17) | 0 | 0 |
| NEO | 230 | 233 | 31 | 60.1 (50.0) | 2.7 | 14.7 | 1 | 4 (4) | 0 | 0 |
| BMD-380 | 162 | 107 | 17 | 36.5 (29.2) | 1.0 | 7.8 | 0 | 6 (6) | 0 | 0 |
| IRIS-W1x1 | 70 | 45 | 7 | 11.8 (9.4) | 0.7 | 3.9 | 0 | 5 (2) | 0 | 0 |
| EMMY-W1 | 28 | 29 | 5 | 8.7 (6.6) | 0.2 | 1.9 | 0 | 0 (0) | 0 | 0 |
| **Total** | **1,978** | **2,104** | **590** | **453 (362)** | **13.3** | **97.6** | **19** | **153 (62)** | **0** | **0** |

The triangulation itself gets 3.5 times faster: 453 ms down to 98 ms, plus 30 ms of CDT on the 19 fallbacks, 128 ms
in all. Plane face time drops by 325 ms of 2,104 (15%). On the five faces with 20 or more loops, the many-hole
circuit-board planes the ticket aimed at, the CDT is 84 ms of 581 ms of MeshFace (15%), and two of the five fall back.

## The heaviest faces, and a sample of ordinary ones

Milliseconds; angles in degrees. "Raw slivers" are the sweep's before flips. All 25 rows pass the gate under the CDT.

| File | Face | Loops | Points | MeshFace | Region | CDT | Seed | Sweep | Flips | CDT tris | Sweep tris | CDT min angle | Sweep min angle | Raw slivers | After flips | Sweep verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| LEXI | 672 | 106 | 1110 | 218.17 | 56.96 | 41.269 | 35.666 | 0.423 | 4.788 | 1318 | 1318 | 0.009651 | 6.558E-06 | 0 | 0 | gate passes |
| TOBY-L4 | 1011 | 249 | 1020 | 213.24 | 176.37 | 19.760 | 15.684 | 0.551 | 5.059 | 1514 | 1514 | 0.04037 | 0 | 65 | 0 | gate passes |
| MPCI | 1379 | 163 | 876 | 94.79 | 63.46 | 12.523 | 9.546 | 0.190 | - | 1198 | - | 0.04037 | - | - | - | refused: face walk did not close |
| LARA | 742 | 101 | 404 | 46.83 | 29.82 | 9.398 | 3.989 | 0.301 | - | 602 | - | 0.03931 | - | - | - | refused: face walk did not close |
| M2-ZED-F9T-20B-00 | 4676 | 19 | 402 | 25.12 | 6.59 | 6.268 | 5.913 | 0.139 | 1.129 | 436 | 436 | 0.2692 | 0.001255 | 0 | 0 | gate passes |
| M2-ZED-F9T-20B-00 | 1847 | 2 | 264 | 11.15 | 2.17 | 3.206 | 2.283 | 0.041 | 1.246 | 264 | 264 | 0.9206 | 0.03992 | 0 | 0 | gate passes |
| M2-ZED-F9T-20B-00 | 3367 | 2 | 264 | 10.80 | 2.20 | 3.180 | 2.782 | 0.051 | 1.078 | 264 | 264 | 0.9206 | 0.03992 | 0 | 0 | gate passes |
| M2-ZED-F9T-20B-00 | 4787 | 2 | 264 | 9.40 | 2.06 | 2.640 | 1.888 | 0.082 | 1.391 | 264 | 264 | 0.9206 | 8.538E-07 | 1 | 0 | gate passes |
| M2-ZED-F9T-20B-00 | 4926 | 2 | 264 | 11.37 | 2.48 | 2.893 | 2.156 | 0.036 | - | 264 | - | 0.9206 | - | - | - | refused: piece not monotone |
| NEO | 31 | 7 | 232 | 36.28 | 3.47 | 11.601 | 11.421 | 0.194 | 3.564 | 242 | 242 | 0.6374 | 0.06168 | 0 | 0 | gate passes |
| NEO | 680 | 13 | 215 | 17.28 | 2.09 | 5.061 | 4.368 | 0.171 | 0.690 | 237 | 237 | 0.08098 | 0.00258 | 0 | 0 | gate passes |
| NEO | 461 | 1 | 184 | 7.85 | 0.82 | 1.825 | 1.383 | 0.111 | 0.555 | 182 | 182 | 0.488 | 0.1053 | 0 | 0 | gate passes |
| M2-ZED-F9T-20B-00 | 417 | 1 | 175 | 7.51 | 1.50 | 1.646 | 1.690 | 0.036 | 0.571 | 173 | 173 | 1.368 | 0.00193 | 0 | 0 | gate passes |
| M2-ZED-F9T-20B-00 | 2819 | 1 | 175 | 6.39 | 1.66 | 1.658 | 1.430 | 0.026 | 0.599 | 173 | 173 | 1.368 | 0.00193 | 0 | 0 | gate passes |
| M2-ZED-F9T-20B-00 | 5090 | 1 | 175 | 6.50 | 1.50 | 1.681 | 1.225 | 0.024 | 0.475 | 173 | 173 | 1.368 | 0 | 1 | 0 | gate passes |
| M2-ZED-F9T-20B-00 | 3574 | 1 | 21 | 0.83 | 0.17 | 0.193 | 0.162 | 0.004 | 0.035 | 19 | 19 | 12.4 | 0 | 2 | 0 | gate passes |
| MPCI | 458 | 2 | 8 | 0.34 | 0.07 | 0.055 | 0.043 | 0.002 | 0.009 | 8 | 8 | 1.123 | 1.123 | 0 | 0 | gate passes |
| MPCI | 1791 | 1 | 9 | 0.44 | 0.09 | 0.082 | 0.058 | 0.002 | 0.011 | 7 | 7 | 7.025 | 1.706 | 0 | 0 | gate passes |
| IRIS-W1x1 | 159 | 1 | 19 | 0.87 | 0.14 | 0.255 | 0.197 | 0.014 | 0.065 | 17 | 17 | 8.231 | 2.939 | 0 | 0 | gate passes |
| LARA | 2438 | 1 | 12 | 0.37 | 0.08 | 0.090 | 0.067 | 0.002 | 0.011 | 10 | 10 | 8.481 | 0.5125 | 0 | 0 | gate passes |
| TOBY-L4 | 3050 | 2 | 22 | 0.84 | 0.14 | 0.196 | 0.151 | 0.004 | 0.037 | 22 | 22 | 10.95 | 1.994 | 0 | 0 | gate passes |
| LARA | 3205 | 2 | 36 | 1.17 | 0.13 | 0.387 | 0.304 | 0.008 | 0.057 | 36 | 36 | 8.34 | 4.843 | 0 | 0 | gate passes |
| MPCI | 2082 | 2 | 35 | 1.50 | 0.30 | 0.389 | 0.315 | 0.009 | 0.073 | 35 | 35 | 2.214 | 0.1615 | 0 | 0 | gate passes |
| EMMY-W1 | 319 | 1 | 11 | 1.01 | 0.14 | 0.260 | 0.204 | 0.004 | 0.058 | 9 | 9 | 7.595 | 0.4773 | 0 | 0 | gate passes |
| M2-ZED-F9T-20B-00 | 2099 | 1 | 30 | 1.17 | 0.28 | 0.270 | 0.202 | 0.006 | 0.042 | 28 | 28 | 0.8418 | 0.2107 | 0 | 0 | gate passes |

## Quality and the contract

- **Gate**: every triangulation the sweep finished passes the layer 5 gate (0 of 1,959). Every CDT passes it (0 of
  1,978).
- **Slivers**: the raw sweep makes 153 slivers in 62 faces, every one a triangle over three nearly collinear boundary
  points (TOBY-L4 1011 has 65, smallest altitude 3.6e-15 against a length tolerance of 1e-5). Each fails the
  contract's degenerate count, and no fallback reason would excuse it. The CDT makes none.
- **The cheap fix**: `DelaunayedIndexed` on the sweep's triangles, the flips the CDT already runs after its seed,
  removes every sliver (0 after flips) and gives the CDT's minimum angle on every face (no face below it). It costs
  84 ms of the 98 ms the sweep path takes, so the fix and the CDT's own flips are the same work. The sweep saves only
  the seed's insertions.
- Chordal accuracy cannot change: every triangulation of a plane face is exact.

## The E4 and E5 seed laws

The supervisor's condition: a sweep is adopted only if it replaces the seed outright (no second plane triangulator)
and keeps every E4 and E5 law, with weakly simple regions a first-class case. Against the prototype:

| Law | What it asks of the seed | The sweep |
|---|---|---|
| `Law_V1Edges_SeedFactsOnSynthetic` | on pad arrays up to 10 x 10 (100 holes, aligned rows) and rectangles with 60 points a side, the seed itself (`SeedFactsHold`) has the complete count, every segment a side once, the region's area, and every triangle above the 1e-9 floor | not as it stands: the raw sweep puts flat triangles on collinear runs (153 here), so it needs the seed's own sliver pass, not only the flips after it |
| `Law_V1Edges_SeedAgreesWhereEarClippingIsComplete` | count and area of the ear-clipped seed where it is complete | yes |
| `Law_V1Edges_SeedHoldsPointHoles` | a one-point hole inside the region becomes a vertex of two more triangles | no: the prototype refuses a loop under three points; a point hole needs a vertex that is split and merge at once |
| `Law_V1Edges_CopiesSeedOnKeyhole` | a loop through one point twice: 6 triangles, each copy on its own side | no: refuses coincident points |
| `Law_V1Edges_CopiesSeedOnSlit` | a side run along both ways, both sides kept | no: refuses coincident points and a vertex on a side |
| `Law_V1Edges_CopiesSeedOnLenaR8Face1349` | two pinch vertices | no: refuses coincident points |
| `Law_V1Edges_CopiesSeedCancelsTail` | a zero-width tail cancels; only the rectangle's 2 triangles | no: refuses a two-way side |
| `Law_V1Edges_PinchesOfWindingOneAreSimple` | the seed covers each pinch of winding one | no: refuses coincident points |
| `Law_V1Edges_SeedOnLaraPads` | LARA faces 742 and 504 hold the seed's facts | no: both refused (face walk did not close; piece not monotone) |
| `Law_V1Edges_SeedOnNoraPlane` | NORA-B100 2745, pads of different holes on one line: no triangle below the floor | not as it stands (the same floor, on the seed); not measured on that face |
| `Law_V1Edges_SeedOnRcbPlane` | RCB-F9T 874: no triangle below the floor | not as it stands (the same floor, on the seed); not measured on that face |

Seven of eleven need copy handling or fail on a witness face, and the three floor laws need a sliver pass inside the seed. The six copy laws need what the seed already has (merge distance, chains through vertices on a segment, two-way
sides cancelling, a copy per corner by the sector holding the triangle). A sweep that met them would rebuild that
machinery around a different core. The 19 faces it refused here (15 "face walk did not close", 4 "piece not
monotone"; 1% of faces, 7% of CDT time) include MPCI 1379 and LARA 742, the two heaviest pad faces after TOBY-L4 and
LEXI. The refusals were not traced to a cause further; several are one-loop faces of 24 to 32 points, which suggests
repeated points or a pinch.

## Conclusion

- Not landed: no Plato sweep was written, nothing was wired, and the third acceptance criterion (a corpus run against
  the late baseline) does not apply. No library law changed verdict.
- The heavy plane faces now cost their region step and the part of MeshFace outside the named stages (TOBY-L4 1011:
  region 176 ms of 213; LEXI 672: 57 ms region, 41 ms CDT, about 107 ms outside region, collision test, CDT and lift).
  A later look at plane face time should start there, not at the triangulator.
- Inside the CDT the seed's insertions are 80% of its time (362 of 453 ms). A sweep-built seed would save at most
  that, about 17% of plane face time, at the price of re-implementing weakly simple regions.
- The entry point the ticket asked for (a UV region with holes and its chart points) already exists:
  `CdtSeedOfRegionOverCopies(UvRegion, Array<Point2D>)` followed by `DelaunayedIndexed`, which a boundary band mesher
  can reuse.
