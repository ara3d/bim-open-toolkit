# catalog-geometry: TYPE-CATALOG.md section 6 (geometry concepts and kinds) and IHasSeams, IHasPoles, IHasClosedFormArea

Ticket: TKT-323
Status: ready: catalog-geometry

## Done
- catalog-geometry, see `git log -- sandbox/step-mesh-staging/catalog-geometry`, about 1.3 h against 2 expected:
  48 `Law_Catalog_` laws, all pass under cpu64 (2026-10-20); zero type errors in this folder.

Types added (16): `CurveKind`, `SurfaceKind`, `Degeneracy`, `Seam`, `Seams`, `Pole`, `PoleSegment`,
`BrepCurveJet`, `CurvatureAt`, `CurvatureBound`, `ParameterSpeed` (the catalog's `Speed`), `Sagitta`,
`BSplineSpan`, `ControlPolygon`, `ConvexHullBound`, `Placement`. Reused from the stdlib, not redeclared:
`SurfaceJet3D` (its fields fit: Uv, Position, DerivativeU/V/UU/UV/VV) and `PrincipalCurvatures`.

Concepts added (11): `IHasCurveDomain`, `IHasSurfaceDomain`, `IEvaluableCurve3D`, `IEvaluableCurve2D`,
`IEvaluableSurface`, `IDifferentiable1`, `IDifferentiable2`, `IProjectable3D`, `IHasClosedFormArea`,
`IHasSeams`, `IHasPoles`. None has an implementer yet (LINT009 info): the arena views are library types and
cannot gain an `implements` clause from staging. `catalog-geometry-views.library.plato` and the
`SeamsOf(ArenaSurface)`, `DegeneracyOf(ArenaSurface, tol)` functions are their obligations.

Files: `catalog-geometry-{kinds,jets,splines}.{types,library,laws}.plato`, `catalog-geometry.concepts.plato`,
`catalog-geometry-arena.library.plato` (the witness arena: one record of every curve and surface case),
`catalog-geometry-views.library.plato`, `catalog-borrowed.types.plato`, `catalog-geometry.spec.plato`.

## Choices where the catalog sketches
- `KindOf`: conics are circle, ellipse, hyperbola, parabola; quadrics are cylinder, cone, sphere; swept
  are revolution and extrusion; derived are trimmed, composite, offset, surface curve, rectangular
  trimmed, offset surface. A `KindOf(BrepCurve2D)` overload is included.
- `Degeneracy` gained a case `CollapsedSides(Sides: Array<DomainSide>)` for three or four collapsed
  sides (a fully collapsed spline): without it `DegeneracyOf` could not agree with `DegenerateSides`.
  `Apex(At)` is reported only when no side is degenerate: the first interior collapsed line, V before
  U, at the start of the other parameter's range. An apex is really a whole iso-line; the
  foundation's `IsoLine` would say so better than `UvPoint` (contract request below).
- `Seam.SeamAt.At` is the range's start; `Seams` comes from the domain's periodicity (`HasSeam`:
  Periodic or Closed). Marker concepts `IPeriodicInU`/`IPeriodicInV` were not added: the catalog
  offers the classification instead, and `Seams` is it.
- `Pole.Point` is the side's image at its middle; `Pole.Normal` is `SurfaceNormal.Limit(LimitNormal)`.
  `PoleSegmentOf(g, s, pole, count)` spaces `count` points along the side, ends included.
- `CurvatureAt.Normal` is the normal curvature along a parameter-plane direction the constructor
  takes (`CurvatureAlong(jet, along: UvDelta)`); the catalog did not say along what. Curvatures are
  signed against the parameterization normal `S_u x S_v`, not ISO's face normal. The second form is
  read in an orthonormal tangent basis, so the principal curvatures lose no digits at an umbilic
  (the first form, H -+ sqrt(H^2 - K), lost half the digits on the sphere and failed the bound law).
- `CurvatureBound` is per surface, not per face: closed form for plane, cylinder, sphere, ring
  torus; `Number.MaxValue` for the cone and spindle torus (unbounded); deferred
  (`CurvatureBoundBySubdivision`) for swept, spline and offset surfaces.
- Surface second partials did not exist in layer 1 except for B-splines. `JetWith` writes them in
  closed form per case; rectangular trimmed recurses into the basis; offset is deferred (`OffsetJet`).
- `BrepCurveJet`, not the stdlib's `CurveJet3D`: that holds a third derivative layer 1 does not compute.
- `ControlPolygon { Points }` holds the Degree + 1 control points of one span; `ConvexHullBound
  { Bound: ModelLength }` is the largest distance of those points from the line through the polygon's
  ends (a valid bound with positive weights; distance to a line is convex).
- `Sagitta` constructors: `ArcSagitta(radius, angle)` (attained) and `ToSagitta(ConvexHullBound)` (a bound).
- `Placement` built only from a checked frame: `ToPlacement(OrthonormalFrame)`.

## Merge instructions
- Move the files into `01-geometry`; `catalog-geometry-arena.library.plato` and the laws stay as laws
  and witnesses of that layer.
- `ArenaCurve implements IHasCurveDomain, IEvaluableCurve3D, IDifferentiable1, IDifferentiable2`;
  `ArenaCurve2D implements IHasCurveDomain, IEvaluableCurve2D`; `ArenaSurface implements
  IHasSurfaceDomain, IEvaluableSurface, IHasSeams, IHasPoles` (the obligations exist).
- Rename `Law_Catalog_*` to the layer's law prefix.

## Contract requests
- `ArenaSurface` cannot implement `IProjectable3D` while layer 1's `Project(ArenaSurface, Point3D):
  UvCoordinate` exists: the same parameters with another return type is CHK203. Change layer 1's
  `Project` to return `Projection`, as the catalog's section 5 intends.
- `Degeneracy.Apex(At: UvPoint)` should be `Apex(At: IsoLine)`: the apex is the whole line v = v0.
- `Placement.Handedness` repeats `OrthonormalFrame.Handedness` (one fact in two fields). Make
  `Placement` the `OrthonormalFrame` itself, or drop the field.
- Layer 1 should own the surface second partials (`JetWith` here) beside `PartialU`/`PartialV`, so
  `Law_SurfaceSecondPartialsMatchDifferences` covers every case and not only B-splines.

## Requests to other tracks
- Section 5 (decided results): `UndecidedReason`, `SurfaceNormal`, `Projection` are borrowed in
  `catalog-borrowed.types.plato` with the catalog's shapes. Does not block; delete at merge.
- Section 4 (checked frames): `OrthonormalFrame` borrowed likewise. Does not block.
- `WorkBudget` not needed.

## Findings
- `Speed` is a stdlib type (`foundation/quantities.types.plato`, metres per second); the catalog's
  `Speed` would halt the compiler. Declared as `ParameterSpeed`; the catalog should be corrected.
- `Pole` as a type compiles beside the `UvPointSource.Pole(Side, Index)` case, and `Sagitta` as a type
  beside layer 4's `Sagitta(m, e, t0, t1): Number` function: different arities, no ambiguity.
- One server run reported "no laws matched" with zero type errors for a folder that parsed under the
  pinned CLI; the same files copied to another fresh path ran all 48 laws. Another instance of the
  server's path cache (foundation's finding).
- Lint (pinned CLI, library plus the three catalog folders): no LINT001 and no warning in this folder;
  LINT003 infos for fields read only by laws, LINT009 infos for the eleven concepts without implementers.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Reading (brief, primer, spec DSL, catalog, foundation and indices, layer 1) | 20 min | |
| Writing types, concepts, libraries | 25 min | |
| Writing laws, arena, spec | 20 min | |
| Type-check runs | 3 min | 4 server runs, 1 CLI lint |
| Law runs | 2 min | 3 runs (46/48, then 48/48) |
| Fixing the umbilic curvature | 8 min | |
| Waiting on the server | 0 min | |
| Committing | 3 min | 1 commit |

## Lessons
- Grep the stdlib's type list for every catalog name before declaring (`Speed`).
- The textbook H -+ sqrt(H^2 - K) is the wrong formula for code: at an umbilic it loses half the digits.
