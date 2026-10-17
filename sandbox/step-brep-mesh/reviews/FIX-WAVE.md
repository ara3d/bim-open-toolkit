# Fix wave: cross-layer decisions

Written 2026-10-17 by the supervising session before the fixers start, so that nine fixers working
in parallel, one per layer, make the same cross-layer change the same way. A fixer applies the
findings for its layer from [MATH-REVIEW-layers-0-6.md](MATH-REVIEW-layers-0-6.md), from the
"Findings in lower layers" sections of `07-validation/README.md` and `08-pipeline/README.md`, and
from this file. One commit per finding; a fixer may skip a finding with a stated reason in its
README's "Fix wave" section. The owner's premise applies: fix the design, do not report around it.

Gate state before the wave: all nine layers merged, `PASS: 0 error(s) in scope; 6357 functions
type-checked`. The wave must end in the same state after the name review.

## Layer 0 changes every layer sees

| Change | Owner adds | Others do |
|---|---|---|
| `Periodicity` gains `Closed(Period: Number)`: a direction whose formula does not wrap but whose ends coincide (a clamped closed B-spline). Layer 3 decides it at decode from `closed_curve` / `closed_surface` or end coincidence. | 0 | every `match` on `Periodicity` gains the arm; layers 2, 4, 5, 6 treat `Closed` like `Periodic` for seams, unwrapping, and the pole and seam synthesis; layer 1 reports it from `IsClosed` |
| `Check` gains `Bound: Number`, set by the constructors (`CheckWithin`, `CheckExact`, `WorseOf`). | 0 | layer 7 stops writing the bound twice |
| `Provenance` gains `KernelCurve(Index: CurveIndex)`, `KernelSurface(Index: SurfaceIndex)`, `WholeInput`. `Report` gains the `Located` constructor layer 8 declared. | 0 | every `match` on `Provenance` gains the arms; layers 1 and 3 report geometry defects at the curve or surface; layers 3, 7, 8 use `WholeInput` for findings about the file as a whole and delete their sentinels |
| `Tolerances.Parameter` splits into `LengthParameter: ParameterTolerance` and `AngleParameter: ParameterTolerance` (per-dimension floors; `ParameterFloor` becomes two functions). | 0 | every `Tolerances` construction and every read of `.Parameter` follows; layer 3 sets both; layer 1 picks the floor by the direction's kind |
| The rounding floor is taken at the coordinate extent, not the model size: `ResolutionAt(extent)` where `extent` is the largest absolute coordinate. | 0 documents it | layer 2 adds `CoordinateExtent(m): Number` and `ModelSize(m): Number`; layer 3 uses them and exports both in `DecodedModel` |
| New in layer 0, moved from `belongs-in` stand-ins: `IntegerTotal`, `IsOnFace(p: MeshVertexProvenance)`, `UnboundedDomain`, `PeriodicRepresentativeAbove`, `IsPeriodicDomain`, `StepOccurrenceIndex`, `Located`, `WholeInput`. | 0 | layers 1, 2, 3, 5, 6, 8 delete their copies (`IsFaceInteriorProvenance` in 5 and `IsOnFace` in 6 both become layer 0's `IsOnFace`) |

## Ownership of duplicated declarations

| Declaration | Owner (keeps or adds) | Deletes its copy |
|---|---|---|
| `PcurvesOf(g, c)`, `Eval(g, c: Curve2DIndex, t)` | 1 | 4 |
| `NormalAgreesWithParameterization(g, s)` | 1 | 2 |
| `IsClosedEdge`, `IsDegenerateEdge` | 2 | 4 |
| the eleven topology queries layer 4 marked `belongs-in: 02-topology`, and `FacesOfEdge(m, e)` without a shell | 2 (adds any it lacks, same signatures) | 4 |
| `IntegerTotal` | 0 | 3, 6 |
| `ScaledCurve`, `ScaledSurface`, `ScaledPcurve` (scaling a length-parameterized direction scales its parameters; an angle direction does not) | 1 (new) | - |
| `ScaledBy(m, factor)`, `RigidlyMoved(m, pose)`, `ScaledPoint` (through layer 1's functions, pcurves included) | 2 (new, with bodies) | 7, 8 |
| `SameConnectivity(a, b)` (compares numberings, layer 8's meaning) | 6 (new) | 7, 8 |
| `SameDiscretization` | 4, moved from the laws block to `EdgeDiscretizing` | - |
| `IsDiscretizedFace` | 5, moved from the laws block to `FaceMeshing` | - |

## Findings assigned by layer

Each fixer reads the review's sections 1 to 5 and the two READMEs' findings lists and applies
every item that names its layer. The items the supervising session wants called out:

- **Layer 1.** Derivative laws: exclude every knot of the span, and bound the finite-difference
  error by the library's own rounding (`ResolutionAt` scaled), never by the file's angle tolerance;
  the conjecture `CentralDifferenceStepSuffices` is refuted and is restated or dropped. Placement
  law admits mirrored frames (determinant -1) and exports the determinant sign for layers 2 and 3.
  The lemon torus's inner part gets the correct normal sign. File-geometry laws export their
  measure, not only a Boolean, so layer 7 can grade them. `IsClosed` reports the new `Closed` case.
  Pcurves on a closed edge: `ClosestParameter` on an unbounded pcurve domain returns a bounded
  representative, and `Law_PcurveAgreesWithCurve` samples a bounded range.
- **Layer 2.** `Law_ShellIsConnected` (a sphere and a torus in one shell fail). `FaceNormalSign`
  accounts for a mirrored placement (layer 1's determinant sign) and for the torus part.
  `EdgeDomain` on a pcurve-backed or unbounded-domain curve. `CoordinateExtent`, `ModelSize`, the
  model transforms. Adopt layer 4's topology queries. `Closed` directions in seam reasoning.
- **Layer 3.** Decide `Closed` at decode. Fold a mirrored placement (determinant -1) into face
  orientation using layer 1's sign, and state the law that the fold preserves the point set.
  Export `ModelSize` and `CoordinateExtent`. Set both parameter floors. Use `WholeInput`. Delete
  `IntegerTotal`, `StepOccurrenceIndex`. Note that `ParseStep` and printing are host obligations
  (owner decision in `PLAN.md`), without changing their signatures.
- **Layer 4.** `Refine`'s precondition ranges over requested edges only; `DiscretizeAll` takes the
  usability guard itself. Delete the duplicated declarations. `Closed` directions. Move
  `SameDiscretization`. Laws judged by file tolerances that are really rounding laws use
  `ResolutionAt`.
- **Layer 5.** Seams placed by the left/right rule of `research/STEP-BREP-MODEL.md` 4.3, not by
  continuity, so a loop through a pole or apex lands each seam use on the right copy; the sphere
  with a seam and the seamed cone mesh. `ChartWindingIsFaceWinding` is false as stated: restate with
  the hypothesis the review gives or drop it; `NormalTurnBoundsCentroidDeviation` is refuted. Add
  the law that every boundary segment of the region is an element edge, which makes
  `ElementsTileRegion` a theorem. `MeshFace` gains the two `ensures` layer 8 relies on (requests
  name the face's own edges; only those edges are read). Move `IsDiscretizedFace`. Use layer 0's
  `IsOnFace`. `Closed` directions.
- **Layer 6.** `SameConnectivity` by numbering. Area-sum and other rounding laws judged by
  `ResolutionAt` with compensated summation named where needed. Delete `IsOnFace` and
  `IntegerTotal`. The genus of components with boundary (`ComponentsOf`, `IsPinchedVertex`
  contracts made total or their partiality stated).
- **Layer 7.** Delete the transforms and `SameConnectivity`; use `Check.Bound`; use the geometry
  measures layer 1 now exports; `WholeInput` for whole-file findings; a witness with one planted bad
  face (layer 8 needs it); the torus volume oracle over a boundary that wraps in v; `ScaledBy` from
  layer 2 scales pcurves.
- **Layer 8.** `Validated` as layer 7 proposes (`ValidateBrep(level)`, `ValidateModelMesh` with the
  model's tolerances and thresholds, `CrossCheck` with criteria). Delete the duplicated transforms,
  `SameConnectivity`, `Located`, `WholeInput`. Correct the two overstated relations in
  `research/VALIDATION-MATH.md` section 6.4 by a note in the pipeline README (the research file
  stays as written, with a pointer).
- **Layer 0.** Everything in the first table; the `Wrap` seam law stays as the author measured it;
  the rounding-floor rule; `ParameterFloor` split.

## Procedure for every fixer

1. Copy the whole sandbox to scratch once at the start as the snapshot of the other layers;
   edit only your own folder in the real tree.
2. For each finding: edit, run the gate over your live folder plus the snapshot of the others
   (expect findings from other fixers' concurrent renames only where this file predicts them),
   commit by path with `git -c platonic.claim=<path>` for each file you changed, one commit per
   finding, message naming the finding, trailers `Ticket: TKT-299`, `Agent: fixer <your agent id>`,
   `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`, then `git push origin main`.
   Never commit a file outside your folder.
3. Record in your layer README under a new section "Fix wave, 2026-10-17": each finding applied
   (one line) and each skipped (with the reason), and update "Changes to the contract".
4. Return: findings applied, skipped with reasons, contract changes, names you now depend on from
   other layers' fixes, the gate result.
