---
id: TKT-414
title: STEP mesher: SHO/NINA-B222-W1x2.STEP does not finish edge discretization in 600 s; it stops with 32 of its 2,132 edges outstanding
status: claimed
depends_on: []
owner: session 260aa3fa
session: 260aa3fa-e3ae-48bb-b5bf-e1c83e2e55ba
fence: [sandbox/step-brep-mesh/04-discretization/**, sandbox/step-mesh-staging/v1-jody/**]
workflow: [W3]
related: [TKT-313, TKT-346, TKT-410]
created: 2026-10-21
claimed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [x] The edge (or edges) that does not return is named with its curve kind and the surfaces it lies on, and discretizes or gets a located diagnostic within the per-edge budget
- [x] The corpus rerun reports no file over 120 s

Found by the corpus rerun of 2026-10-21 (library 8984df4b, bim-open-data 3245cb7): the only file over the 120 s limit, killed at 'stage edges 2100/2132' (rows on every core, so the 32 outstanding edges are not the last 32 by index); rerun alone with a 600 s limit and no warm-up it was killed again with nothing written, so at least one edge runs over 8 minutes or does not terminate. In October (docs/plans/step-mesher-corpus-2026-10-19.md) the file failed in PrepareModel like the other B-spline files, and its census noted that 21 of its 2,131 SURFACE_CURVE edges threw on the closure test, the only such edges outside ELLA-W1; ELLA-W1's 20,684 surface-curve edges now all throw the stub of TKT-410 in 0.4 ms each and do not hang, so the hang is in an edge that gets past that point. Next step: a probe that discretizes each edge of the file in its own time box and names the one that does not return; the harness's time mode writes nothing until every row is done. TKT-346 bounded the raise loops for termination on the kinds it had witnesses for; this edge is a new witness.

## Log

- 2026-10-22, session 260aa3fa (track v1-jody, chunk J5, assigned by the v1 supervisor): takes over the stale claim of session 53a578f9. The hang is gone since v1-edges' E2 (the file meshes in 0.6 s in the 2026-10-22 corpus run), but 16 SURFACE_CURVE edges (cylinder+plane 13, plane+torus 3: 600, 1234, 1239, 1262, 1264, 1365, 1368, 1427, 1498, 1500, 1507, 1508, 1509, 1510, 1518, 1530) return 0 segments in 0.2 to 0.4 ms with no exception and no diagnostic, and 26 faces are undiscretized. J5: name the cause, witness it, fix it in staging, and make a silent 0 a located diagnostic.

## Cause of the 16 silent edges (2026-10-22, v1-jody J5)

A probe over the decoded file (C# regenerated from toolkit ab717770) gives each edge's range and record. All 16 are SURFACE_CURVEs mastered by their first pcurve, whose domain is the master pcurve's (`MasterPcurveDomain`, from E2). Two causes, eight edges each:

- Master a 2D B-spline circle on a plane (600, 1239, 1262, 1264, 1365, 1427, 1518, 1530): three rational quadratic arcs, first and last control points the same point, knots [-2 pi/3, 0, 0, 2 pi/3, 2 pi/3, 4 pi/3, 4 pi/3, 2 pi, 2 pi, 8 pi/3]. A plane has no period and layer 3 decides no closure for a 2D curve, so the domain stays [0, 2 pi] Aperiodic: closed edge 600 gets [a, a]; the arcs across the join get backward ranges ([5.47, 0.81] for 1262).
- Master a 2D line along u on a cylinder whose v velocity is a rounding residue the file writes (7e-17 to 6e-16; 1234, 1368, 1498, 1500, 1507, 1508, 1509, 1510). `ParameterPeriodOn` tests that component for exact 0, so the line has no period, the pcurve search runs over an unbounded domain, and the vertices' parameters come out near 1e14 (1498: [2e-13, 3.75e14]).

Every such range fails `IsTractableRange`, and `DiscretizeEdgeRangedCounted` returns Undiscretized. Nothing reports it: layer 8's `EdgeDiagnosticsInRange` asks `CanDiscretizeInRange`, which tests only Start < End, so an increasing absurd range (1498, 1500, 1507, 1510) passes it; and the host (`StepPlatoMesher`) does not ask for layer 8's edge diagnostics at all, so even the backward ranges reach the corpus tables as a bare 0.

## Fix (staged, track v1-jody, chunk J5)

`sandbox/step-mesh-staging/v1-jody/surface-curve-pcurve-domain.library.plato`: `ParameterPeriodOnV1` counts a velocity component within the arithmetic resolution of the other as zero; `MasterPcurveDomainV1` makes a bounded master domain Closed when the 2D record closes (`IsClosedRecord`: a B-spline whose domain-end knots have multiplicity at least the degree, so its ends are its first and last control points, and those are the same point); `CanDiscretizeInRangeV1` asks `IsTractableRange`, the discretizer's own test; `UndiscretizedEdgeMeasured` names the refused ranges and carries the range's span as its measure. Merge steps in the track's TRACK.md.

Laws (block `V1JodySurfaceCurvePcurveDomainLaws`, cpu64): 5 pass, with v1-edges' 4 surface-curve laws. Corpus: C# regenerated from toolkit ab717770 without and with J5 wired in (0 degraded bodies), `step-corpus-harness all <corpus> <out> 120 --path host --parallel`: all 88 files finish in both runs (NINA-B222 in 4.9 s), 87 identical in every edge's segment count, every face's outcome and the mesh digest; NINA-B222's 16 edges discretize, its 26 undiscretized faces mesh, and its 145 shells all close with 0 boundary edges. Corpus totals: undiscretized faces 26 to 0, zero-segment edges 16 to 0, fully meshed files 81 to 82. Open: the host does not ask for layer 8's edge diagnostics, so a refused edge is still a bare 0 in the harness tables (request in the track's TRACK.md).
