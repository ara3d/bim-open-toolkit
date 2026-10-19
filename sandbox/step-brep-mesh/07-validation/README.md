# 07-validation: checks, oracles, witnesses

Layer 7 of the STEP B-rep to mesh design. It turns the laws of layers 0 to 6 into evidence
(`Check`), grades the evidence into a `Report`, and adds what no lower layer can state alone: a mesh
compared with its model, quantities computed twice by routes that share no code, and models whose
every count, area and volume is known in closed form. Library block `BrepChecking`; laws block
`BrepCheckingLaws`. Nothing here uses OpenCascade or any other kernel: validation rests on
mathematics, on hand-written witnesses, and on public files.

## Files

| File | Block | Holds |
|---|---|---|
| `validation.types.plato` | (types) | `ConformanceLevel`, `CheckFamily`, the Green oracle's `GreenSegment`, `GreenPath`, `TrigCoefficients`, `WitnessFacts`, the corpus records `ExpectedMeasure`, `CorpusFeature`, `CorpusCount`, `CorpusEntry` |
| `validation-checks.library.plato` | `BrepChecking` | the entry points: `ValidateStep`, `ValidateBrep`, `ValidateDiscretizations`, `ValidateFaceMesh`, `ValidateFaceMeshOutcome`, `ValidateModelMesh`, `ValidateAssembly`, `CrossCheck`; levels as data |
| `validation-checks-common.library.plato` | `BrepCheckingCommon` | the samplers every `Check_` is built from (`CheckAll`, `CheckAllWithin`, `CheckGrid`, `CheckGridWithin`), provenance helpers, report builders (`ExactReport`, `MeasuredReport`, `QualityReport`) |
| `validation-checks-topology.library.plato` | `BrepCheckingTopology` | 44 checks: layer 0's model tolerances, layer 2's laws and self-tests |
| `validation-checks-geometry.library.plato` | `BrepCheckingGeometry` | 95 checks: layer 1's laws over the geometry arena, and its self-tests |
| `validation-checks-step.library.plato` | `BrepCheckingStep` | 60 checks: layer 3's file, schema, decode and units laws |
| `validation-checks-where.library.plato` | `BrepCheckingWhere` | 110 checks, one per WHERE rule law of layer 3, generated from `step-where.laws.plato`; `WhereRulesReport` |
| `validation-checks-discretization.library.plato` | `BrepCheckingDiscretization` | 36 checks: layer 4 |
| `validation-checks-face-meshing.library.plato` | `BrepCheckingFaceMeshing` | 45 checks: layer 5 |
| `validation-checks-mesh.library.plato` | `BrepCheckingMesh` | 123 checks: layer 6 |
| `validation-checks-cross.library.plato` | `BrepCrossChecking` | 17 cross checks of a mesh against its model; `CrossReport`, `ModelOracleReport` |
| `validation-checks-reports.library.plato` | `BrepCheckingReports` | one report per layer and input, split by `CheckFamily`; generated (see "Implementation notes") |
| `validation-oracles.library.plato` | `BrepOracles` | closed forms, the Green's-theorem area, the divergence volume, the Euler and angle-defect oracles, the area envelope |
| `validation-witnesses.library.plato` | `BrepWitnesses` | the witness models written out as `BrepModel` values, and their facts |
| `validation-comparisons.library.plato` | `BrepComparisons` | model comparisons (`SameModel`) and the sagitta measure of the chordal law |
| `validation-corpus.library.plato` | `BrepCorpus` | the public STEP corpus as data |
| `validation.laws.plato` | `BrepCheckingLaws` | cross-check laws, oracle-against-closed-form laws, check-and-law agreement, levels, corpus |
| `validation-witnesses.laws.plato` | `BrepWitnessesLaws` | witness and negative-witness laws; the laws that mesh a witness are layer 8's `pipeline-witnesses.laws.plato` |
| `validation.spec.plato` | (spec) | invariants, entry-point and oracle contracts, the three deferred functions, every witness, theorems, conjectures |

## Three independent sources of truth

A check that compares the mesher with itself proves little. Each quantity this layer judges is
known by at least one route that shares no code with the code under test.

1. **Mathematics.** Oracles compute areas, volumes and Euler characteristics from the exact B-rep:
   Green's theorem over each face's loops in its parameter plane, the divergence theorem over each
   shell, raw cell counts with the reduction's corrections. They call layer 1's evaluation and
   inverse evaluation and layer 2's domains and senses, never a discretization or a triangulation.
   Closed forms (`Oracle_CylinderPatchArea`, `Oracle_SphereArea`, `Oracle_TorusArea`,
   `Oracle_ConePatchArea`, `Oracle_PlanarFaceArea`) check the Green oracle in turn.
2. **Witnesses.** Ten positive models, three negative ones and one with a planted bad face, written out as values, each with
   its counts, genus, face areas and shell volumes from closed forms (`WitnessFacts`). A negative
   witness breaks exactly the laws its comment names.
3. **Public files.** Thirty-six STEP files from STEP Tools, OpenCascade's sample data, the u-blox
   module library, NASA and NIST, each with the conventions and defects it exercises and the counts
   the survey measured (`BrepCorpus`). NIST's test cases carry their own volume and area as AP242
   validation properties.

## Conformance levels

A level is a set of check families. `Requires(level, family)` compares two ranks; `ForLevel` is the
only place a level becomes a set of checks.

| Level | Families run | Typical use |
|---|---|---|
| `Structural` | `StructureChecks` | every run; what a downstream consumer relies on (indices, closure, orientation, Euler) |
| `Geometric` | `StructureChecks`, `GeometryChecks`, `QualityChecks` | the default of `ValidateStep` and `ValidateBrep`; the file's own geometry against its tolerances, the mesh against its criteria |
| `Oracle` | all five, adding `OracleChecks` and `SelfTestChecks` | release tests, corpus runs; area and volume against the oracles, the library's self-tests |

| Family | What it holds | Severity |
|---|---|---|
| `StructureChecks` | exact laws about indices, records, topology, schema, WHERE rules | Error (Warning or Info where layer 2 or 3 grades the law lower) |
| `GeometryChecks` | measured laws with a tolerance or criterion as bound | Warning below ten times the bound, Error above |
| `QualityChecks` | element quality thresholds, forced short segments | Info |
| `OracleChecks` | comparisons with an oracle within a derived envelope | Error |
| `SelfTestChecks` | laws of the library's own functions on fixed inputs (reversal, round trips, conversions, recomputed triangulations) | Error |

## Severity rules

Severity comes from layer 0's `SeverityOf(ConstraintGroup, worst, bound)`, with the bound the
check itself carries (`Check.Bound`, the bound of the sample the fold kept), through four builders:

- `ExactReport(check, message)`: group `Topological`, always Error. Also the oracle comparisons,
  whose diagnostics still carry the measure and the per-face or per-body envelope.
- `MeasuredReport(check, message)`: group `Geometric`, Warning while `worst < 10 bound`, Error
  beyond.
- `WarningReport(check, message)`: an exact law its layer grades a Warning (two of layer 3's file
  laws, three WHERE rules); `AsWarning` restates the failure as Worst 2 against bound 1.
- `QualityReport(check, message)`: group `Quality`, always Info.

A measured law whose bound differs by sample (a face's area envelope, a body's tube) folds with
`CheckAllWithinEach`, and layer 0's `WorseOf` keeps the sample furthest past its own bound.

`IsClean` means no Error. A Geometric warning therefore never fails a run; ten times the bound
does.

## The Green's-theorem oracle

The area of a face is the integral of the area element h(u, v) = |S_u x S_v| over its region in
the parameter plane. Take a potential G with dG/dv = h along v and set P = -G(v). Green's theorem
gives the area as the closed integral of P du around the region's boundary, counter-clockwise in
(u, v) for a face whose normal agrees with the surface's.

The region's boundary in the plane has three kinds of side:

- **Coedge sides.** Each coedge is sampled at n + 1 points of its edge domain in the composed
  direction, each projected into the surface's parameters, unwrapped for continuity, and joined by
  straight segments. A sample on a collapsed line (a pole or an apex) takes its neighbour's u.
- **Seam sides.** A seam is used twice in one loop, once each way, a period apart in u. P depends
  on v only, so the two uses cancel exactly; the oracle needs no special case.
- **Pole sides.** Where the boundary reaches a collapsed line at one u and leaves at another, the
  region's true boundary runs along the collapsed line between them. That side has length zero in
  space but not in the plane, and contributes -G(v_pole) times its u-span. `PoleDeltaU` chooses the
  span's sign from the direction of travel and the face's sense; a vertex loop at a pole contributes
  a whole period; a loop that winds once in u around a pole it never touches gets an implicit pole
  side that balances the winding (`ImplicitPoleSegments`). On a torus, a loop that winds in v gets
  cut segments to a common u, which close the region (`CutSegments`).

On a straight segment the integral of P du is -du times the mean of G over the segment, which has a
closed form for every potential below (the mean of sin v over a segment is sin(v_m) sinc(dv/2)). So
the polygon's integral is exact; the only error is the polygon's distance from the true pcurve. The
oracle runs at 32 and 64 chords per coedge and extrapolates, (4 A(64) - A(32)) / 3 (Richardson);
`GreenAllowance` is the size of that correction plus rounding. Loops straight in (u, v), such as
iso-lines and pole sides, need no correction at all: the witnesses' sphere, torus, cylinder side
and cone side are exact up to rounding.

On a closed surface (a sphere bounded by two vertex loops) the region is fixed only up to the whole
surface; a raw area that comes out non-positive is lifted by the total area.

### Antiderivatives

Parameters are natural (ISO 10303-42): u an angle or a length, v a length or an angle.

| Surface | h(u, v) | G(v) | Where exact |
|---|---|---|---|
| Plane | 1 | v | always |
| Cylinder, radius R | R | R v | always |
| Cone, radius R, semi-angle a | \|R + v tan a\| / cos a | (R v + tan a v^2 / 2) / cos a, sign of R + v tan a | each nappe |
| Sphere, radius R | R^2 cos v | R^2 sin v | always |
| Torus, radii R, r | r (R + r cos v) | r (R v + r sin v), sign of R + r cos v | ring torus everywhere; spindle by side |
| Revolution of a line coplanar with the axis | \|V\| rho(v), rho linear | \|V\| (rho_0 v + (rho_1 - rho_0) v^2 / 2) | segments not crossing the axis |
| Linear extrusion of a line, constant direction | \|V x E\| | \|V x E\| v | always |
| B-spline, offset, rectangular trimmed, other profiles | no closed form | quadrature (`AreaSegmentByQuadrature`, deferred): Gauss-Legendre, ceil(3p/2) points per knot span in v (8 off a spline), 5 points along the segment | exponential convergence per smooth patch |

`Oracle_PlanarFaceArea` computes a planar face's area exactly from its lines and conics (a chord
term per segment plus each arc's segment area), a second route that `Law_PlanarFaceAreaMatchesGreen`
compares with Green.

## The divergence-theorem volume

The volume a closed shell encloses is one third of the flux of x - O through it, O the centre of
the shell's bounding box. Over one face that flux is the integral of f(u, v) = (S - O) . (S_u x S_v)
over the region; with F an antiderivative of f in v, it is again a closed integral of -F du over the
same boundary as the area. For the elementary surfaces F is a trigonometric polynomial in u,
F = A(v) + B(v) cos u + C(v) sin u (`TrigCoefficients`), exact on segments of constant v and
integrated by 5-point Gauss-Legendre otherwise, then extrapolated as the area is.
`DivergenceAllowance` is the Richardson correction plus rounding. A face whose loops wind in v (the
torus witness) uses the area's cut pairs: Green's theorem on the cut-open region holds for any
potential, and the cuts lie at constant v, where the trigonometric integral is exact. Where the area
oracle fixes a region only up to the whole closed surface, the face adds the surface's whole flux,
three times the volume it encloses (`ClosedSurfaceVolume`), with its normal sign, as the area adds
the whole area. A surface without a closed-form F gives NaN.

## The area tolerance

A mesh face's area cannot be bounded by the chordal criterion alone: a fine zigzag stays within d of
a surface and has any area at all. It is bounded by chordal and angular together.

Let d = SurfaceChordal + Length (the element's distance from the surface), d_e = EffectiveChordal +
Length (the boundary chords' distance from the exact boundary), theta = 2 SurfaceAngular (an element
normal is within SurfaceAngular of the surface normal at its centroid, which turns by at most
another SurfaceAngular across the element) and kappa the surface's largest absolute principal
curvature over the face. Projecting an element onto the surface along normals scales length by at
most 1 + kappa d in each direction and tilts by at most theta, so

    |A_mesh - A| <= A ((1 + kappa d)^2 / cos theta - 1) + d_e P + GreenAllowance

with A the oracle's area and P the face's perimeter (`Oracle_FacePerimeter`). `FaceAreaTolerance`
computes it; kappa is 0 on a plane, 1/R on a cylinder and sphere, max(1/r, 1/(R - r)) on a ring
torus, cos a / rho_min on a cone (infinite at an apex, so the bound is vacuous there), sampled for
other surfaces (`SampledCurvatureBound`, deferred). The solid's volume gets the analogous tube bound
`TubeVolume` = 2 d A + (4 pi / 3) |chi| d^3 (Weyl's formula, valid while d is below the reach).

## Witnesses

Every positive witness is written out as a `BrepModel` value: points, curves, surfaces, edges,
loops, faces, shells and bodies in literal tables or loops over small literal tables.
`Witness_UnitBox` is fully literal; `Law_UnitBoxIsBoxOfOnes` checks it against the parameterized
`Witness_Box(1, 1, 1)`. Counts are raw (V, E, F, L); chi is the reduced Euler characteristic.
`Witness_UnitBoxMillimetres` is the same tables relabelled in millimetres, the 1 mm cube of
`adapter/fixtures/unit-cube.stp` that layer 3's raw witnesses (`03-step/step-raw-witnesses.library.plato`) build on.

| k | Witness | Shell counts V, E, F, L | chi | Face areas | Shell volumes |
|---|---|---|---|---|---|
| 0 | `Witness_UnitBox`, `Witness_Box(w, d, h)` | 8, 12, 6, 6 | 2 | w d (2), w h (2), d h (2) | w d h |
| (none) | `Witness_UnitBoxMillimetres`: `Witness_UnitBox` with `Unit` Millimetre, coordinates kept (exact) | 8, 12, 6, 6 | 2 | 1 mm^2 (6) | 1 mm^3 |
| 1 | `Witness_Cylinder(r, h, 2 pi)`: one seam, two circles, planar caps | 2, 3, 3, 3 | 2 | 2 pi r h, pi r^2 (2) | pi r^2 h |
| 8 | `Witness_Cylinder(r, h, sweep)`, sweep below a turn: a sector | 6, 9, 5, 5 | 2 | sweep r^2 / 2 (2), sweep r h, r h (2) | sweep r^2 h / 2 |
| 2 | `Witness_Sphere(r)`: one seam whose ends are the poles | 2, 1, 1, 1 | 2 | 4 pi r^2 | 4 pi r^3 / 3 |
| 9 | `Witness_SphereByPoleLoops(r)`: two pole vertex loops, no edge | 2, 0, 1, 2 | 2 | 4 pi r^2 | 4 pi r^3 / 3 |
| 3 | `Witness_Torus(R, r)`, (2, 1/2): two seams crossing at one vertex | 1, 2, 1, 1 | 0 | 4 pi^2 R r | 2 pi^2 R r^2 |
| 4 | `Witness_Cone(r, h)`, (1, 1): apex vertex on the side's collapsed line | 2, 2, 2, 2 | 2 | pi r sqrt(r^2 + h^2), pi r^2 | pi r^2 h / 3 |
| 5 | `Witness_BlockWithThroughHole(a, c, w)`, (3, 1, 1): genus one | 16, 24, 10, 12 | 0 | a^2 - w^2 (2), a c (4), w c (4) | (a^2 - w^2) c |
| 6 | `Witness_HollowBox(a, b)`, (2, 1): outer shell and a void | 8, 12, 6, 6 twice | 2, 2 | a^2 (6), b^2 (6) | a^3, -b^3 |
| 7 | `Witness_BSplinePatchSolid(bump)`, 1/2: unit cube, biquadratic Bezier top | 8, 12, 6, 6 | 2 | 1 (5); top in [1, 1 + 16 bump^2 / 45] | 1 + bump / 9 |

Negative witnesses, each failing exactly the named laws of layer 2 (research/VALIDATION-MATH.md
7.2):

| Witness | Raw counts | Fails |
|---|---|---|
| `Witness_SphereWithRedundantPoleLoops(r)` | 2, 1, 1, 3 (chi raw 0, reduced 2) | `Law_NoRedundantVertexLoop` (Warning), `Law_VertexLoopVertexIsIsolated` |
| `Witness_BoxWithFlippedFace` | 8, 12, 6, 6 | `Law_LoopWindingMatchesSameSense` at face 0 |
| `Witness_TwoBoxesSharingCorner` | 15, 24, 12, 12 (chi 3) | `Law_EulerPoincareEvenAndBounded`, `Law_VertexLinkIsOneCycle` at vertex 6 |

A planted bad face for layer 8's failure-isolation law:

| Witness | Holds | Expected diagnostics when meshed |
|---|---|---|
| `Witness_BoxWithPolyLoopSheet` | the unit box (shell 0, body 0) and face 6, a triangle at z = 3 bounded by a poly loop, alone in open shell 1 (body 1, a shell set) | at face 6: layer 5's `FACE-POLY-LOOP` and `Law_EveryFaceIsMeshed`, both Errors; at shell 1: whatever layer 2's poly-loop counting reports (finding 6); nothing at the box |

`WitnessAt(k)` and `FactsAt(k)` index the positive witnesses by k modulo 10, so a law quantifies
over all of them with one Integer.

## Corpus

Source is the collection; the file is its name within it. Volumes and areas are Unpublished except
where NIST's files carry validation properties; a test then checks the counts and that the reports
are clean.

| File | Collection | Exporter | Exercises | Counts |
|---|---|---|---|---|
| `block.stp` | STEP Tools AP203 | ACIS | planar faces, `intersection_curve` on bare planes, degrees, placements without ref_direction | 6 faces |
| `moon_buggy_asm.stp` | STEP Tools AP203 | Unigraphics 10.5 | vertex loops on sphere and cone, torus with major < minor, mapped-item assembly, extrusion, B-splines, inch, degree | |
| `as1_pe.stp` | STEP Tools AP203 | Pro/ENGINEER | context-dependent assembly, inch, degree | |
| `turbine.stp` | STEP Tools AP203 | Unigraphics 13 | cones, degrees, size | 1,241 faces |
| `bull.stp` | STEP Tools AP203 | CADDS 5 | B-spline and rational B-spline faces | |
| `clip.stp` | STEP Tools AP203 | CATIA V4 | short names, faceted B-rep with poly loops | |
| `cubcylso.stp` | STEP Tools AP203 | CATIA V4 | 0.1 mm uncertainty | |
| `as1-ec-214.stp` | STEP Tools AP214 | CAS.CADE | every edge with two pcurves, master `PCURVE_S2` | |
| `io1-tc-214.stp` | STEP Tools AP214 | Theorem | surfaces of revolution, 1e-13 mm uncertainty, non-unit directions | |
| `as1-ug-214.stp` | STEP Tools AP214 | Unigraphics 16 | assembly, degree | |
| `screw.step`, `linkrods.step` | OpenCascade data/step | Euclid | seams with pcurves, tori, cones, rational B-splines, line breaks in strings | |
| `SHO/NORA-B101.step` | u-blox | OpenCascade 6.8 | seam loops, B-splines, assembly | 117 seam loops |
| `SHO/IRIS-W1x1.step` | u-blox | OpenCascade 6.8 | sphere faces bounded by a pole vertex loop | |
| `SHO/ELLA-W1.STEP` | u-blox | OpenCascade 6.2 | pcurves | 8,386 pcurves |
| `SHO/NINA-B222-W1x2.STEP` | u-blox | FreeCAD | pcurves, `seam_curve` | |
| `SHO/c211_case_with_odin_v1.step` | u-blox | Autodesk | seams on cylinders, cones, spheres, tori | |
| `SHO/ODIN-W260.STEP` | u-blox | Spatial | voids, cylinder bands with two outer bounds, pole inside a wrapping loop, out-of-order complex units, metres | |
| `SHO/THEO-P173.STEP` | u-blox | Spatial | closed shells with free edges | 366 surface models |
| `POS/ANN-MB2.step` | u-blox | SolidWorks 2016 | voids | |
| `SHO/BMD-301.STEP` | u-blox | SolidWorks 2017 | lines with \|V\| = 1000, split periodic faces | |
| `SHO/JODY-W3.STEP` | u-blox | SolidWorks 2017 | sphere poles as loop vertices | 24 such sphere faces, 16 surface models |
| `CEL/LENA-R8.STEP` | u-blox | Creo 2022 | degrees, extrusions | |
| `SHO/M2-JODY-W377-00C_PCIE-UART.step` | u-blox | FreeCAD | large assembly | 1,218 occurrences, 1,071 surface models |
| `rassor_shrinkwrap.stp` | NASA 3D Resources | Creo | size, voids, degrees, extrusions, B-splines | 13,394 faces, 2 void bodies |
| NIST CTC-01 to CTC-05, FTC-06 to FTC-11 | NIST MBE PMI | five exporters, AP242 | cylinders, cones, tori, B-spline blends, holes | volume and area in-file |

## Laws

Every approximate comparison names its bound. "Exact" means integer or Boolean equality.
"Allowance" is the oracle's own: `GreenAllowance` (area) or `DivergenceAllowance` (volume), the
Richardson correction plus rounding. Severity applies where the law backs a `Check_`.

### Cross checks (`validation.laws.plato`)

The rows without a `Law_` prefix are predicates of a model and the mesh made from it, not laws: a
generated mesh need not be the model's (finding F-54, 2026-10-18). `CrossCheck` evaluates them on
the pipeline's output, and layer 8 states eleven of them as laws of the same names over
`MeshModel`'s inputs (`Law_MeshEulerEqualsBrepEuler(m, o, s)` and the others in
`pipeline.laws.plato`, "The mesh against its model"). `EveryFaceIsMeshed`,
`ElementNormalAgreesWithFaceNormal`, `FaceAreaMatchesOracle` and `SolidVolumeWithinTube` hold only
where meshing succeeded and stay checks; layer 8's `Law_EmptyFaceIsDiagnosed` and
`Law_WitnessMeshCrossChecksClean` cover them.

| Law | Statement | Tolerance | Severity |
|---|---|---|---|
| `EveryFaceIsMeshed` | every face has at least one element | exact | Error |
| `MeshEulerEqualsBrepEuler` | a shell's complete mesh has the shell's reduced chi | exact | Error |
| `MeshClosedExactlyWhenShellClosed` | a shell's complete mesh is closed iff the shell has no free edge | exact | Error |
| `ProvenanceNamesModelCell` | each mesh vertex's provenance names a model cell | exact | Error |
| `SolidShellMeshesShareNoVertex` | outer and void shell meshes are vertex-disjoint | exact | Error |
| `OuterShellVolumePositive` | a closed oriented outer shell mesh has volume above rounding | `VolumeRoundoff` | Error |
| `VoidShellVolumeNegative` | a closed oriented void mesh has volume below minus rounding | `VolumeRoundoff` | Error |
| `VertexReevaluatesFromProvenance` | each vertex is within Length of the point its provenance names | Length | W/E |
| `CornerNormalIsFaceNormal` | each corner normal is the face normal at its parameters | Angle | W/E |
| `ElementNormalAgreesWithFaceNormal` | each element normal is within SurfaceAngular of the exact surface's | SurfaceAngular | W/E |
| `FaceAreaMatchesOracle` | mesh face area equals the Green area | `FaceAreaTolerance` | Error |
| `AngleDefectMatchesBrepEuler` | angle defects less quad defects sum to 2 pi chi | Angle per vertex and quad | Error |
| `SolidVolumeWithinTube` | mesh solid volume equals the divergence volume | `TubeVolume` | Error |
| `Law_ReducedEulerMatchesOracle` | layer 2's reduced chi equals the oracle's | exact | Error |
| `Law_OuterShellExactVolumePositive` | exact outer shell volume above 2 Length A | 2 Length A | Error |
| `Law_VoidShellExactVolumeNegative` | exact void volume below -2 Length A | 2 Length A | Error |
| `Law_PlanarFaceAreaMatchesGreen` | exact planar area equals Green area | allowance | Error |

### Oracles against closed forms

`Law_GreenEqualsCylinderPatchArea`, `...CylinderSectorPatchArea`, `...SphereArea`,
`...SphereAreaByPoleLoops`, `...TorusArea`, `...ConePatchArea`, `...BoxFaceArea`: the Green area of
the matching parameterized witness face equals the closed form within the allowance, for every
positive size. `Law_DivergenceEqualsTorusVolume`: the divergence volume of the torus witness, whose
loop winds in v, is 2 pi^2 R r^2 within the allowance. `Law_PlanarOracleEqualsDiskArea`: the exact planar oracle gives pi r^2 within
rounding. `Law_GreenDiskAreaWithinArcResidual`: the Green area of a disk is within r^2 (2 pi)^5 /
(960 n^4) plus rounding (the residual after Richardson on a circular arc).

### Agreement of checks and laws

Six sampler laws (`Law_CheckAllHoldsExactlyWhenEverySampleHolds`, `Law_FailingCheckAllNamesAFailingSample`,
and the `Within` and `Grid` forms) state for every exact check at once that a check holds exactly
when its law holds at every sample, and that a failing check names a failing sample. Measured checks
fold a measure written beside the law, so each gets its own agreement law (17 for layers 0 to 6, 5
for the cross checks; the measured checks the fix wave added have none yet, open item 5), for example `Law_SagittaCheckAgrees`: when
`Check_SagittaWithinChordal` holds, `Law_SagittaWithinChordal` holds at every entry and segment.
Exact.

### Levels, reports, corpus

`Law_MergeAllIsCleanExactlyWhenEveryPartIsClean`, `Law_GeometricRequiresWhatStructuralRequires`,
`Law_OracleRequiresWhatGeometricRequires`; `Law_CorpusNamesUnique`, `Law_CorpusMeasuresSensible`,
`Law_CorpusCountsPositive`, `Law_CorpusEntryExercisesAFeature`. All exact.

### Witnesses (`validation-witnesses.laws.plato`)

The laws that mesh a witness (meshed and clean, the hollow box's meshed volumes, the planted bad
face, the metamorphic relations) moved to layer 8's `pipeline-witnesses.laws.plato` in the name
review, because meshing is layer 8's and this layer may not name it.

| Law | Statement | Tolerance |
|---|---|---|
| `Law_WitnessHasStatedCounts`, `...StatedShellCount`, `...StatedFaceCount` | raw counts as the facts state | exact |
| `Law_WitnessStatedCountsImplyStatedGenus` | the facts table agrees with itself | exact |
| `Law_WitnessEulerIsTwoMinusTwiceGenus` | reduced chi = 2 - 2 g | exact |
| `Law_WitnessOracleEulerMatchesLayerTwo` | oracle chi = layer 2 chi | exact |
| `Law_WitnessIsStructurallyClean`, `Law_WitnessValidatesClean`, `Law_WitnessIsOracleClean` | `ValidateBrep` clean at each level | (the checks' own) |
| `Law_UnitBoxIsBoxOfOnes`, `Law_BoxHasStatedCounts`, `Law_BoxValidatesClean`, `Law_CylinderHasStatedCounts`, `Law_CylinderValidatesClean` | the parameterized families for every positive size | exact |
| `Law_WitnessGreenAreaMatchesFacts` | each face's Green area equals its stated area | allowance |
| `Law_WitnessDivergenceVolumeMatchesFacts` | each shell's divergence volume equals its stated signed volume | allowance |
| `Law_BSplineTopAreaInBracket` | the Bezier top's area lies in its bracket | allowance |
| `Law_RedundantPoleLoops...`, `Law_FlippedFace...`, `Law_SharedCorner...` (9) | each named check fails; the structure family has exactly that many diagnostics | exact |
| `Law_TighterChordalNeverIncreasesSagitta` | on line-and-circle witnesses, a tighter chordal never raises the largest sagitta | `ResolutionAt(extent)` |

Theorems in `validation.spec.plato`: `SampledCheckAgreesWithLaw`, `HigherLevelCleanImpliesLowerClean`,
`GreenAreaExactOnStraightLoops`, `MeshAreaWithinEnvelope`, `MeshEulerEqualsBrepEulerByConstruction`,
`ReducedEulerOracleAgrees`, `SolidShellVolumeSigns`. No conjectures.

## Open items

1. **The short entry points.** `ValidateDiscretizations(m, d)` and `ValidateFaceMesh(m, fm)` run the
   structural family only, since the criteria are not in their arguments; `ValidateModelMesh(mesh)`
   uses tolerances at sixteen times the mesh's floating-point resolution. Callers with criteria should
   use the long forms.
2. **Sphere witness reading.** VOCABULARY.md's "two poles" is read as poles at the seam's ends
   (`Witness_Sphere`); the vertex-loop variant is `Witness_SphereByPoleLoops`, and the variant with
   both is a negative witness.
3. **NIST validation properties.** Reading them needs a decoder for AP242's
   `geometric_validation_property`; not in layer 3.
4. **Messages.** Report messages of the generated reports are the law's name in words. A message
   per law, written by hand, would read better.
5. **Agreement laws for the fix wave's measured checks.** The eleven layer 1 file-geometry checks,
   `Check_CurveAgreesWithPcurve`, `Check_SurfaceWithinSurfaceChordalOfElement`,
   `Check_CertifiedSagittaWithinChordal` and the two oracle checks fold a measure that is their law's
   left side behind the law's own guard, so they agree with their laws by construction; each still
   lacks the written agreement law the older measured checks have.
6. **Laws without a check.** `Law_RigidMotionKeepsCoedgeSense` (layer 2) takes an arbitrary frame,
   `Law_MeshFaceReadsOnlyFaceEdges` (layer 5) a second discretization set, and layer 3's
   `Law_DecodeFindingsPointAtTheirSubject` and `Law_ParseFindingsPointAtTheirSubject` a diagnostic
   code (no list of codes is exported) or the text; all four are harness inputs. Layer 0's library
   laws over scalars and records are run by the random law runner, not by a `Check_`.

## Implementation notes

- **Generated files.** `validation-checks-where.library.plato` was generated from the law signatures
  of `03-step/step-where.laws.plato`, and `validation-checks-reports.library.plato` from the check
  libraries (the fix wave edited both by hand: a rerun must keep the `WarningReport` grades and the
  hand-written messages): a check's family comes from its section heading, a measured check's bound is taken from
  a table of the 17 measured checks, the Warning and Info grades from the check's comment. Rerun the
  script (kept in the session scratchpad as `genreports.py`) whenever a check is added; it belongs
  under `tools/` once the design leaves the sandbox.
- **Bounds written once.** Each measured check's bound is written in the check alone; the report
  reads it from `Check.Bound`.
- **File size.** The per-layer check files hold 30 to 120 declarations, above the 12 the brief
  suggests. They are grouped by the layer whose laws they check, so one file changes when one layer's
  laws change; splitting by section would scatter that.
- **Lambdas.** The samplers take `Function1` and `Function2` arguments; the gate does not type-check
  lambda bodies (a negative control with `Number + Integer` inside a lambda passed), so lambda bodies
  here were checked by reading.
- **Assumed compiler fixes.** None of the layer's functions depends on a compiler change; matches are
  on parameters only (a match on a local indexed from an array is typed `Any`, CHK304), and no
  function filters an array (no `Filter` on `Array` in the tiers the gate compiles).

## Gate

Run 2026-10-17 over copies of layers 00 to 07 with the driver of PLATO-PRIMER.md E.3: PASS, 0
errors, 6,257 functions type-checked; one Info (LINT010 on `CorpusEntry`, cleared when the corpus
library was added). Over layers 00 to 08: PASS, 0 errors, 6,357 functions.

Fix wave, 2026-10-17: after each commit, over this folder and a snapshot of the other eight layers
taken from `main`; the last run over all nine layers as committed on `main`, the other fixers
finished: PASS, 0 errors in scope, 6,693 functions type-checked.

## Changes to the contract

| Old | New | Reason |
|---|---|---|
| `ValidateStep(file)`, `ValidateBrep(m)` | kept, at `Geometric`; added `(file, level)`, `(m, level)` | a level is data, not a separate function |
| `ValidateDiscretizations(m, d)`, `ValidateFaceMesh(m, fm)`, `ValidateModelMesh(mesh)` | kept, structural; added `(m, d, c, floors, level)`, `(m, d, fm, c, level)`, `(mesh, t, th, level)`, `ValidateFaceMeshOutcome(o)`, `ValidateAssembly(m, d, faceMeshes, mesh, level)` | geometric checks need the criteria and tolerances the short forms lack |
| `CrossCheck(m, mesh, level)` | kept; added `CrossCheck(m, mesh, level, c)` | element normals, face areas and volumes are judged against the criteria |
| (none) | `CheckFamily`, `Requires`, `ForLevel`, `LevelRank`, `FamilyRank` | conformance as data |
| (none) | `Oracle_SphereZoneArea`, `Oracle_TorusPatchArea`, `Oracle_BodyVolume`, `Oracle_QuadDefectSum`, `Oracle_EdgeLength`, `Oracle_FacePerimeter`, `GreenAllowance`, `DivergenceAllowance`, `FaceAreaTolerance` | the envelopes the cross laws need |
| witnesses, counts stated | as stated, plus `Witness_Box(w, d, h)`, `Witness_Cylinder(r, h, sweep)`, sized forms of every witness, `Witness_SphereByPoleLoops` and three negative witnesses; the default forms call the sized ones | parameterized laws and negative controls |
| (none) | `WitnessFacts`, `WitnessAt`, `FactsAt`, `CorpusEntry` and its records, `Corpus` | witnesses and corpus as data |
| (none) | `WitnessOptions`, `WitnessOutcome`, `WitnessMesh`, `SameModel` | the witness laws mesh through layer 8; the transforms are layer 2's and `SameConnectivity` layer 6's (fix wave) |
| `ExactReport(c, msg)`, `MeasuredReport(c, bound, msg)`, `QualityReport(c, bound, msg)` | `MeasuredReport(c, msg)`, `QualityReport(c, msg)`; added `WarningReport(c, msg)`, `AsWarning(c)`, `CheckAllWithinEach`, `CheckGridWithinEach` | layer 0's `Check.Bound` (fix wave) |
| `MovedBy`, `ScaledBy`, `ScaledPoint` and their parts, `ScaledCriteria`, `MeshOnce`, `WitnessCriteria`, `SameConnectivity`, `WindsInV`, `ModelSizeOf`, `IsShellElement` | deleted; `WitnessOptions`, `WitnessOutcome`, `WitnessMesh` mesh through layer 8; layers 2 and 6 own the transforms and the comparison | FIX-WAVE ownership table |
| (none) | `Law_EveryFaceIsMeshed`, `HasMeshElements`, `IsCompleteShellMesh`, `IsFaceAreaJudged`, `IsSolidVolumeJudged` | one finding per refused face; per-face envelopes as check bounds |
| (none) | `Witness_BoxWithPolyLoopSheet`, `PlantedBadFace`, five planted-face laws | layer 8's failure-isolation law |
| (none) | `ClosedSurfaceVolume`, `Law_DivergenceEqualsTorusVolume` | the torus volume oracle is total |
| (none) | `Curve2DSite`, `IsEdgeProvenance`, `CoordinateExtentOf`, `OffCurvePoint`, `OffSurfacePoint`, `ParameterOfSlot`, `CertifiedSagittaAt`, `CurvePcurveDeviation` | provenance, extents and the new checks |
| witness laws `Law_RigidMotionKeepsConnectivity`, `Law_RigidMotionMovesMesh`, `Law_PowerOfTwoScalingKeepsConnectivity`; theorem `RigidMotionCommutesWithMeshing`; conjectures `ScalingByAnyFactorKeepsConnectivity`, `TighterChordalNeverIncreasesDeviation` | layer 8's metamorphic laws run over the witnesses (`Law_Witness...`); the theorem and both conjectures dropped as false | layer 8 decisions 11 and 12 |

## Findings in lower layers

1. **Duplicate signatures.** The gate accepts two declarations with the same name, parameter types
   and return type. Found: `PcurvesOf(GeometrySet, CurveIndex)` and `Eval(GeometrySet, Curve2DIndex,
   Number)` in layers 1 and 4; `NormalAgreesWithParameterization(GeometrySet, SurfaceIndex)` in layer
   1 (with a body) and layer 2 (bodiless, `belongs-in`); `IsClosedEdge` and `IsDegenerateEdge(BrepModel,
   BrepEdgeIndex)` in layers 2 and 4; `IntegerTotal(Array<Integer>)` in layers 3 and 6. Layer 8 and
   this layer both declare `ScaledPoint(Point3D, Number)`, `ScaledBy(BrepModel, Number)` and
   `SameConnectivity(ModelMesh, ModelMesh)`; this layer's `ScaledBy` has a body but leaves pcurves
   unscaled, layer 8's is bodiless with the fuller contract, and layer 8's `SameConnectivity`
   compares numberings where this one compares vertex counts. One of each pair should go.
2. **Near-synonyms.** `IsOnFace` (layer 6) and `IsFaceInteriorProvenance` (layer 5) mean the same;
   `FacesOfEdge(m, e)` (layer 4) and `FacesOfEdge(m, s, e)` (layer 2) differ only by the shell.
3. **`Provenance` has no geometry case** (layer 0). Resolved in the fix wave: layer 0 added
   `KernelCurve`, `KernelSurface` and `WholeInput`, and this layer uses them.
4. **`Check` has no `Bound`** (layer 0). Resolved in the fix wave: `Check.Bound`; layer 0 has no
   Warning grade for an exact law, so `AsWarning` restates one as Worst 2 against bound 1.
5. **Layer 1 exports Booleans only** for its file-geometry laws (placement orthonormality and the
   like), so they are graded as exact Errors here; exporting the measure would allow the ten-times
   Warning grading.
6. **Poly-loop shells and layer 2's Euler laws.** Before the fix wave a poly loop's points were not
   counted, so a single triangle sheet had chi = 1 with no free edge and failed the open-shell Euler
   law. Layer 2's fix wave identifies poly-loop points by coincidence in `ReducedCounts`; whether
   `BoundaryCycleCount` (deferred) walks a poly loop's implicit edges decides whether the sheet of
   `Witness_BoxWithPolyLoopSheet` passes, so that witness's laws allow a finding at shell 1.
7. **The gate skips lambda bodies** (see "Implementation notes").
8. **Layer 6 cites `Law_AngleDefectMatchesBrepEuler`** as this layer's; it is declared here.
9. **Layer 8's `Validated`** calls `m.ValidateBrep` (always Geometric, ignoring `o.Level`),
   `mesh.ValidateModelMesh` (structural, without the model's tolerances), and `CrossCheck(mesh,
   level)` without criteria, so Oracle-level runs skip the area and volume envelopes. Proposed:
   `m.ValidateBrep(level)`, `mesh.ValidateModelMesh(m.Tolerances, MeshQualityThresholds.CubitAcceptable,
   level)`, `m.CrossCheck(mesh, level, o.Face)`.

## Fix wave, 2026-10-17

Findings from `reviews/FIX-WAVE.md`, `reviews/MATH-REVIEW-layers-0-6.md` and layer 8's README,
one commit each.

| Finding | Done |
|---|---|
| Torus volume over a boundary that winds in v (open item 1) | `FaceVolumeTerm` integrates the area's boundary with its cut pairs and adds `ClosedSurfaceVolume` where the region is fixed only up to the whole surface; `WindsInV` deleted; `Law_DivergenceEqualsTorusVolume` added |
| The transforms and `SameConnectivity` (FIX-WAVE ownership table); meshed witness laws through layer 8's `MeshModel` (open items 2 and 3) | `validation-transforms.library.plato` becomes `validation-comparisons.library.plato` (`BrepComparisons`): `MovedBy`, `ScaledBy`, `ScaledPoint`, their curve and surface parts, `ScaledLimit`, `ScaledCriteria`, `MeshOnce`, `WitnessCriteria` and `SameConnectivity` deleted. The witness laws mesh with `MeshModel` under layer 8's `Witness_UnitScaleOptions`, and the metamorphic laws are layer 8's laws run over the witnesses, so this layer needs no transform of its own |
| `Law_RigidMotionKeepsConnectivity` and theorem `RigidMotionCommutesWithMeshing` are false (layer 8, decision 11: the unit box's square faces have two equally Delaunay diagonals, and a rotation that is not a quarter turn can pick the other) | dropped, with conjecture `ScalingByAnyFactorKeepsConnectivity`, which a tie refutes the same way |
| Conjecture `TighterChordalNeverIncreasesDeviation` is false (layer 8, decision 12: on `y = h sin(2 pi x)` the nested sub-span from 0 to 3/4 deviates about 1.33 h, the whole span h) | dropped; `Law_TighterChordalNeverIncreasesSagitta` stays, restricted to lines and circles, where a circle's uniform split makes the sampled sagitta increase with the segment's angle |
| A face the mesher refused made every whole-shell cross check fail too (Euler, closure, angle defects, volume signs), so one bad face gave several Errors at its shell | `Law_EveryFaceIsMeshed` reports a face without an element at the face; the whole-shell laws take the hypothesis that the shell's mesh is complete (`IsCompleteShellMesh`), and `Law_SolidVolumeWithinTube` that every shell of the body is |
| A witness with one planted bad face (layer 8, "What is left open" item 2) | `Witness_BoxWithPolyLoopSheet`, its expected diagnostics in its comment and the table above, and five laws that run layer 8's `Law_FailedFaceLeavesOthersUnchanged` at it non-vacuously |
| `Check.Bound` (FIX-WAVE layer 0 table; review C9) | the report builders take no bound; `WarningReport` and `AsWarning` replace "bound 1 against Worst 1" for Warning-graded exact laws; `Check_FaceAreaMatchesOracle` and `Check_SolidVolumeWithinTube` are measured against their per-face and per-body envelopes with `CheckAllWithinEach` |
| Layer 0's split parameter floor | `ResolutionTolerances` builds both floors from layer 0's floor functions at the mesh's coordinate extent; `Check_ParameterTolerancePositive` checks both floors; `Check_CirclePeriodIsTwoPi` takes the angle floor; the pole and collapse tests take layer 1's `ParameterFloorAlong` |
| Layer 0's new `Provenance` cases | `MeshVertexOf` and `MeshElementOf` gain the `WholeInput`, `KernelCurve`, `KernelSurface` arms |
| Layer 4's law changes | `Check_AtLeastTwoParameters` becomes `Check_EmptyOrAtLeastTwoParameters`; `Check_UndiscretizedExactlyWhenUnusable` added; `Check_ImageFollowsPcurve`, `PcurveGapAt` and `Law_ImageFollowsPcurveCheckAgrees` dropped with the law |
| Layer 6's rounding laws lose their tolerance argument | eight checks drop their `Tolerances` parameter and argument |

These five landed in one commit: each alone fails the gate against the refreshed snapshot, since
the reports file calls every layer's checks.
| Layer 6's `RestrictedToFaces` (coordinator; review section 6, condition 1) | `RestrictedToShell` is `mesh.RestrictedToFaces(m.ShellFaces(s))`, a valid `ModelMesh` (the hand-built one had empty corner arrays), and `ShellMeshEuler` reads layer 6's `ReferencedEulerCharacteristic`; `IsShellElement` deleted |
| `WholeInput` for whole-file findings, `KernelCurve` and `KernelSurface` where a geometry record is at fault; no finding left at `Nowhere` (layer 8's request) | `CurveSite` and `SurfaceSite` are the records themselves; `PcurveSite` falls back to the pcurve's surface; parameter-plane curves report at the pcurve that uses them (`Curve2DSite`); `CheckOnce`, attribute samplers, decode-map, schema-table and mesh-wide self-tests report at `WholeInput`; the unit and uncertainty laws at their instance. Only the holding seed of a fold (`NoSampleCheck`) keeps `Nowhere`, and it never becomes a finding |
| `ModelSize(points)` is a forwarder to be deleted (layer 3); the resolvability floor at the coordinate extent (review F6) | `ModelSizeOf` deleted; `Check_LengthToleranceResolvable` and its agreement law evaluate at layer 2's `CoordinateExtent(m)`, the sagitta law's rounding too; `ResolutionTolerances` reads layer 2's `BoundingDiagonal` |

These two landed in one commit, since both edit the topology checks.

### Answers to layer 8

- **Do the short entry points take a level?** No: `ValidateBrep(m)` and `ValidateModelMesh(mesh)`
  keep the signatures VOCABULARY.md fixes, at `Geometric` and `Structural`. Each has a long form that
  takes one, `ValidateBrep(m, level)` and `ValidateModelMesh(mesh, t, th, level)`, and
  `CrossCheck(m, mesh, level, c)` takes the criteria; layer 8's decision 10 calls the long forms, which
  is what this layer intends. A Structural run pays only for the structure family.
- **Is any finding left at `Nowhere`?** No. Every `Check_` names the cell, record, instance, mesh
  vertex or element it sampled, or `WholeInput` for a finding about the input as a whole. The holding
  seed of a fold keeps `Nowhere` and never becomes a diagnostic, since `ReportOf` builds one only for a
  failed check, and a failed fold keeps a failed sample's provenance.
| Layer 2's new laws and grades | checks added for `Law_NoRedundantVertexLoop` and `Law_PcurveSurfaceIsAFaceSurface` (Warnings), `Law_PolyLoopHasThreePoints`, `Law_PolyLoopEdgesPairUp`, `Law_OpenShellVertexLinkIsCycleOrPath`, `Law_OpenShellEulerEvenAndBounded`, `Law_ShellIsConnected` (review M1), `Law_ShellIsOrientable`, `Law_PcurveRunsWithCurve`, `Law_CurveAgreesWithPcurve` (measured), and as self-tests `Law_EdgeReversalKeepsCoedgeSense`, `Law_EdgeReversalKeepsEdgeDomain`, `Law_ParameterizationSignIsConstantOnFace`, `Law_ReversingEveryFaceKeepsCoherence`, `Law_ModelSizeWithinExtent`; `Check_EdgeHasPositiveExtent` reported as a Warning. Not checked: `Law_RigidMotionKeepsCoedgeSense`, which takes an arbitrary frame, a harness input. The redundant-pole-loop witness now fails `Law_NoRedundantVertexLoop` (Warning) and `Law_VertexLoopVertexIsIsolated`, since `Law_FaceBoundsShareNoVertex` leaves redundant loops out |
| Layer 1's `GeometrySet.Closures` | every witness's arena gains an empty closure table; `SameModel` compares it |
| Layer 4's `Law_CertifiedSagittaWithinChordal` | `Check_CertifiedSagittaWithinChordal`, measured by layer 4's exact `Sagitta`, a self-test |
| Layer 5's new laws | `Check_SurfaceWithinSurfaceChordalOfElement` (measured, review M6), and as self-tests `Check_SeamUsesOnOppositeCopies` (review M8), `Check_BoundarySegmentIsElementSide` (review M5), `Check_InteriorSideIsShared`, `Check_ElementLiftsFacingFaceNormal` (review H5), `Check_RequestsNameFaceEdges`; `Check_PointNormalIsFaceNormal`'s comment names the bound `ResolutionAt(1)`. Not checked: `Law_MeshFaceReadsOnlyFaceEdges`, which takes a second discretization set; layer 8's `Law_OutcomesAreCurrent` runs it over the loop's states |
| Layer 1 exports the measures of its file-geometry laws (finding 5 of "Findings in lower layers") | eleven geometry checks fold the measures (`PlacementDeviation`, `TrimExcess`, `TrimBoxExcess`, `SegmentGap`, `SupportGap`, `PcurveToCurveGap`, `CurveToPcurveGap`, `PcurveDomainExcess`, `CollapsedLineSpread`) and are reported Warning below ten times the tolerance; per-kind parameter floors go in as per-sample bounds (`CheckGridWithinEach`). `OffsetReferenceAngle` and `ExtrusionProfileAngle` are lower bounds with no excess to grade, so those two stay exact Errors. `Law_WitnessMeshValidatesClean` takes layer 8's new `MeshingOptions.Quality` |
| The remaining new laws of layers 1, 2, 3 and 6 | layer 1: off-curve and off-surface inverse evaluation (`Check_ClosestParameterNoWorseThanSample`, `...IsStationary`, `Check_ProjectNoWorseThanSample`, `...IsStationary`, review M4), `Check_ProjectNearRecoversFromNearbySeed` (seeded off the answer), `Check_PcurveClosestParameterIsBounded` (review F4b), the three scaling laws at factor 2, the two closure-mark laws; layer 2: `Check_ScalingScalesExtent`; layer 3: the closure, mirror-fold, magnitude, resolvability and floor laws of the decode; layer 6: the spanning-forest component laws, `Check_OrientedSurfaceWithBoundaryHasGenus`, `Check_EulerIsTwoMinusTwiceGenusMinusBoundaryCycles`, `Check_VectorAreaVanishes` (review M11), the restriction laws, and `Check_CornerProvenanceIsOnItsElementFace` (review M9). Four laws stay unchecked (open item 6) |

## Name review, 2026-10-17

The name-and-dependency review after the fix wave (VOCABULARY.md revision 3) changed this layer as follows.

- Deleted `IsRedundantVertexLoop(m, f, j)` from `BrepOracles` (layer 2 owns it; two declarations with one signature left the call to the compiler's choice, so the oracle was never an independent route for this rule), and `LoopOfBoundaryPoint` and `LoopStart` from `BrepCheckingFaceMeshing` (layer 5's `LoopOfBoundaryPoint` and `LoopOffset`); `SlotOfBoundaryPoint` uses layer 5's.
- Upward references removed: `WitnessOptions`, `WitnessOutcome`, `WitnessMesh` (from `BrepComparisons`) and the sixteen laws that mesh a witness (`Law_WitnessMeshesOk`, `Law_WitnessMeshCrossChecksClean`, `Law_WitnessMeshValidatesClean`, the three `Law_HollowBox...Mesh...` laws, the five `Law_PlantedBadFace...` laws with `IsAboutPlantedSheet`, and the five `Law_Witness...` metamorphic laws) named layer 8's `MeshModel`, `MeshingOptions`, `FinalState` and laws. They moved to layer 8's `pipeline-witnesses.laws.plato`. `Witness_BoxWithPolyLoopSheet` and `PlantedBadFace` stay here; the spec's `ensures` lines and `tested by` entries that named the moved laws are dropped.
- Renamed `Check_SeamUsesAreInOneFace` to `Check_SeamUsesRunOpposite`, following layer 2's rename of the law to `Law_SeamUsesRunOpposite`.

## Implementation, chunk A

TKT-314, 2026-10-17. TASKS.md listed `ValidateBrep`, `ValidateModelMesh` and `CrossCheck` at
`Structural` and `Geometric`, and the planar area oracle at `Oracle`; all four already had bodies
in the checks libraries, and on the box witnesses they reach no deferred function of this layer
(`AreaSegmentByQuadrature`, `SampledCurvatureBound` and `EdgeLengthByQuadrature` serve curved and
spline faces, chunks B, C, F). Three changes:

- `SameModel` compares every table (finding F-51; commit 6409fa52): parameter-plane curves,
  pcurves, loop and body cases, poly-loop points.
- `Oracle_EulerCharacteristic` counts redundant vertex loops by its own rule,
  `OracleDropsVertexLoop` (finding F-48.1).
- `Law_AngleDefectMatchesBrepEuler` adds the rounding of its sum (`ResolutionAt` of 2 pi per
  vertex and quad), layer 6's rule for comparing totals. Without it the unit box failed in 32 bits:
  a sum of 4 pi errs by about 1e-6 against the witness's angle tolerance of 1e-8 rad per vertex.

Results, provisional (scratch compiler): validating the meshed unit box and `Witness_Box(2, 3, 4)`
at the Oracle level gives 260 checks each, every Error-family check holding. The one false check is
`Law_LengthToleranceResolvable` (a Warning: 1e-6 is below 32-bit resolution at coordinate 1), and on
the 2 x 3 x 4 box also `TriangleMinAngleMeetsThreshold` (Info: ear clipping's diagonal of a
3 x 4 face). On `Witness_BoxWithPolyLoopSheet` the Errors are exactly `FACE-POLY-LOOP` and
`Law_EveryFaceIsMeshed` at face 6, and `Law_OpenShellEulerEvenAndBounded` at shell 1 (see layer
2's README), all inside the sheet.

