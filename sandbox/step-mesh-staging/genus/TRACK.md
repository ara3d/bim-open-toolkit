# genus: step G (holes and voids), the cone's Green-area sign, and SharesCurveParameter's body

Ticket: TKT-328 (step G, the cone sign F-55), TKT-314 (SharesCurveParameter, F-52 item 7)
Status: merged in 848b66d6

Verdicts are from Plato 88aa0277 (the fallback CLI of `docs/plans/step-mesher-v2.md`) with this
folder as an extra root, `--budget=900`, under `gpu32` (the default) and `cpu64`.

## Done

- Before this folder, in the library (direct commits of plan version 1): step G's laws
  `Law_BlockWithHoleMeshIsOneTorus` and `Law_HollowBoxMeshIsTwoSpheres` (ca7b969f), and the
  witnesses they need. Step G needs no new body in layers 2 or 6 to 8.
- `genus-cone-green.*.plato`: the cone's Green area on its nappe (F-55). Before (library):
  `Law_GreenEqualsConePatchArea` fails under both profiles (case r = 2, h = 9.0457);
  `Law_WitnessGreenAreaMatchesFacts` fails under cpu64 at k = 4, f = 0 (the unit cone's side,
  -4.4429 against 4.4429) and passes under gpu32 only because the apex's sign rounds positive in 32
  bits. After (staged forms, both profiles): `Law_Genus_ConeGreenEqualsPatchArea` pass (25 cases),
  `Law_Genus_WitnessGreenAreaMatchesFacts` pass (196, exhaustive),
  `Law_Genus_GreenOnNappeIsGreenOffCones` pass (196, exhaustive: no face off a cone changes).
- `genus-pcurve.*.plato`: `SharesCurveParameterBody`, now that step B moved `CopiesInside` to
  layer 0 (a042c4ad) and gave `ClosestParameter` its OnSurface closed form (d97966dc, 2f5115a4).
  Before: the library's `Law_PcurveAtCurveSpeedSharesParameter` and
  `Law_PcurveAtDoubleSpeedSharesNoParameter` stop at the bodiless `SharesCurveParameter`. After
  (staged forms, both profiles): `Law_Genus_PcurveAtCurveSpeedSharesParameter` pass,
  `Law_Genus_PcurveAtDoubleSpeedSharesNoParameter` pass.

## Merge instructions

Cone (into `07-validation/validation-oracles.library.plato`):
- Move `FaceNappeSign`, `NappeSign`, `FarthestSignedRadius`, `ConeAreaSegment` and
  `IsConeSurface` into the library's "Area potentials per surface" section.
- `AreaSegment(surface, g, seg)` gains a last parameter `nappe: Number`; its Cone arm becomes
  `ConeAreaSegment(radius, semiAngle, seg) * nappe`; every other arm is unchanged. Then delete
  `AreaSegmentOnNappe`.
- `RawGreenArea(m, f, n)` takes the body of `RawGreenAreaOnNappe` with `AreaSegment(m.Geometry,
  seg, nappe)` in place of `AreaSegmentOnNappe`. Delete `RawGreenAreaOnNappe`.
- Delete the staging copies `GreenAreaOnNappe`, `FaceAreaByGreenOnNappe` and
  `GreenAllowanceOnNappe`: `GreenArea`, `Oracle_FaceAreaByGreen` and `GreenAllowance` read the fixed
  `RawGreenArea`.
- Delete `genus-cone-green.laws.plato`: the library's `Law_GreenEqualsConePatchArea` and
  `Law_WitnessGreenAreaMatchesFacts` state the first two laws, and the third compares a function
  with itself once merged. Expect both library laws to pass under both profiles after the merge.

SharesCurveParameter (into `02-topology/topology.library.plato`):
- `SharesCurveParameter(m, e, k)` takes the body of `SharesCurveParameterBody`; move
  `EdgeBreakFractions` and `SpanSharesCurveParameter` beside it, in the section "Pcurves". Delete
  `SharesCurveParameterBody`, and remove "one deferred algorithm" from `02-topology/README.md`'s
  file table and "Deferred functions" section (the layer then has none).
- Delete `genus-pcurve.laws.plato`: the library's `Law_PcurveAtCurveSpeedSharesParameter` and
  `Law_PcurveAtDoubleSpeedSharesNoParameter` state the same over `SharesCurveParameter`. Expect
  them, and `Law_BoxWithBottomPcurveValidatesClean`, to pass.

## Contract requests

- None. `AreaSegment`'s new parameter is a merge-time change inside layer 7, with one caller.

## Requests to other tracks

- None open. Step B's three commits above were the requests of plan version 1.

## Findings

- **F-55, the cone's Green-area sign.** `AreaSegment` multiplied the cone's potential by the sign of
  rho = R + v tan a at each segment's middle. On a cone standing on its apex, the base edge (G(0) =
  0) and the two seam passes (du = 0) contribute nothing, so the area is the pole side's at the
  apex, where rho is 0 and its sign is rounding noise: the area came out as minus the area (cpu64,
  unit cone) or near 0 (gpu32, r = 2.515, h = 2.974). `GreenAllowance`, read from the same
  `GreenArea`, was then near 0 too (3.8e-8 against a 32-bit rounding of 1.9e-6 on an area of
  30.8), so the fix needs the allowance to follow. The torus arm has the same form,
  `(major + minor cos v).Sign` per segment; it is safe on a ring torus, where that never reaches 0,
  and would fail the same way on a spindle torus (major < minor), which no witness has.

## Step G under gpu32

Run of 2026-10-18 at 23:28, 32 s wall, one compile: 21 pass, 4 obligation.
- Pass: `Law_BlockWithHoleMeshIsOneTorus`, `Law_HollowBoxMeshIsTwoSpheres`, the three
  `Law_HollowBox*Volume*` laws (25 sampled sizes each), `Law_EulerPoincareEvenAndBounded`,
  `Law_VertexLinkIsOneCycle`, the three `Law_SharedCorner*` laws (Witness_TwoBoxesSharingCorner
  fails exactly its two named laws), `Law_WitnessEulerIsTwoMinusTwiceGenus` (196 cases).
- Per witness (scratch laws over k = 5, the block with a through hole, and k = 6, the hollow box):
  `WitnessMeshesOk`, `WitnessMeshCrossChecksClean`, `WitnessMeshValidatesClean`,
  `WitnessDivergenceVolumeMatchesFacts` and `WitnessIsOracleClean` pass on both. Witness 5's last
  failure (F-53, layer 1's derivative allowance) was fixed by step B in 3f06da40.
- Obligation: `Law_WitnessDivergenceVolumeMatchesFacts`, `Law_WitnessMeshesOk`,
  `Law_WitnessMeshCrossChecksClean`, `Law_WitnessMeshValidatesClean` over every k stop at curved
  witnesses (`ExpandedPoles`, `ProjectBySearch`: tracks C and F).
- So TKT-328's first criterion holds on the interpreter under gpu32; its C# half waits on TKT-315
  and track E.

## Durations

| Step | Wall time | Runs |
|---|---|---|
| Cone diagnosis (two scratch calls, one law run) | 12 min | 3 |
| Cone fix: first try, allowance found, second try | 6 min | 4 (two per profile) |
| SharesCurveParameter body | included above | shared runs |
| Step G under gpu32 | 1 min | 1 |
| Layer 07 and 08 F-54 commit (7e709372): verification | 78 min | 1 server call timed out at 30 min; 2 CLI runs of 8 min |

## Lessons
- A law-server call that meshes the torus outlives the script's 30-minute client timeout under this
  load, and the server goes on working on a request nobody waits for. Laws that mesh every witness
  belong on the CLI with a small budget until TKT-335's hot spots are paid.

- A sign read from rounding noise passed under one profile and failed under the other: running
  both profiles found the allowance defect that one profile hid.
- A function and its library with one name (`ScratchCone2`) make `--call` print the library, not
  the value. Name scratch functions apart from their library.
