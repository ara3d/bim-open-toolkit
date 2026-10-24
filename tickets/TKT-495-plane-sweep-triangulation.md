---
id: TKT-495
title: STEP mesher: measure an O(B log B) sweep-line (monotone) triangulation of plane faces against the CDT, and land it as the plane path if it is faster and breaks no contract
status: done
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/plane-sweep/**, docs/plans/step-mesher-plane-sweep-2026-10-22.md, sandbox/step-brep-mesh/05-face-meshing/triangulation-sweep*.plato, sandbox/step-brep-mesh/05-face-meshing/face-meshing-v1-plane.library.plato, deps/bim-open-data/src/data/Ara3D.StepBrep/**, deps.json]
workflow: [W3]
related: [TKT-323, TKT-349, TKT-468, TKT-462, TKT-405]
created: 2026-10-22
closed: 2026-10-23
---

## Acceptance criteria

- [x] A measurement over the heaviest plane faces of the late 2026-10-22 corpus run and a sample of ordinary ones records, per face, time against today's CDT, triangle count, minimum angle, sliver count under the contract's measure, and the contract verdict; the verdict with its numbers is committed in docs/plans/step-mesher-plane-sweep-2026-10-22.md whatever it is
- [ ] If it lands: the sweep is new library files with laws (every boundary segment a side; exact cover with no overlap and consistent orientation; area and boundary agree with the CDT; each degenerate case passes or falls back to the CDT), wired as the plane path with the CDT as fallback, and the entry point takes any UV region with holes and its chart points
- [ ] If it lands: a corpus run against the late 2026-10-22 baseline meshes no fewer faces, closes no fewer shells and passes the contract on no fewer files, with plane face time and the slowest files reported before and after

Plane faces are triangulated by the constrained Delaunay triangulation (`TriangulateRegionCdt`: the insertion seed of `CdtSeedOverCopies`, then `DelaunayedIndexed`). Any triangulation of a plane face is exact, and the version 1 contract asks for no element quality beyond the absence of degenerate elements (slivers at 2 area / longest side^2 below 1e-9 in the harness; smallest altitude above the length tolerance in layer 7's `ElementIsNotDegenerate`), so a plane needs no Delaunay property. The late corpus run of 2026-10-22 (`corpus-1022c`, parallel, loaded machine) shows the heavy planes at seconds each: TOBY-L4's 249-loop face 4.5 s, MPCI's 163-loop face 3.6 s, LEXI's 106-loop face 3.5 s, for about 1,000 boundary points, where an O(B log B) sweep should take milliseconds.

The experiment: a throwaway measurement (scratchpad or `sandbox/step-mesh-staging/plane-sweep/`) that, per heavy and ordinary plane face, times today's `TriangulateRegionCdt` against a monotone-decomposition sweep triangulation (de Berg et al. chapter 3, holes handled natively, no bridges) on the same chart points, and records the triangle count, the minimum angle, the sliver count under the contract's measure, and whether the face passes the contract. The verdict, with numbers, goes to `docs/plans/step-mesher-plane-sweep-2026-10-22.md` whatever it is. If the sweep is several times faster on many-hole faces and breaks nothing, it lands in the library as new files with laws (every boundary segment a side; exact cover, no overlaps, consistent orientation; area and boundary agree with the CDT; each degenerate case passes or falls back to the CDT), wired as the plane path with the CDT as the fallback, regenerated once from a committed state, and measured against the late 2026-10-22 corpus baseline.

The entry point takes a UV region with holes and its chart points, not only plane faces, so track (d) can reuse it for a boundary band.

## Verdict (2026-10-23)

Not landed. At bim-open-data `2a74c53b` the CDT is 22% of plane face time (453 of 2,104 ms over 1,978 plane faces in 9 files); the sweep plus the CDT's own flips would cut plane face time 1.18 times, the raw sweep leaves 153 slivers in 62 faces, and it keeps 1 of the 11 E4/E5 seed laws. Numbers in `docs/plans/step-mesher-plane-sweep-2026-10-22.md`. The two remaining criteria are conditional on landing and do not apply.

## Closed with criteria unmet

2026-10-23: measured, not landed: the CDT is 22% of plane face time at pin 2a74c53b, so the sweep gives 1.18x and keeps 1 of 11 E4/E5 seed laws; the two landing criteria do not apply (docs/plans/step-mesher-plane-sweep-2026-10-22.md)
