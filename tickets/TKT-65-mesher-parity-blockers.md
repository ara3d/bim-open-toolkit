---
id: TKT-65
title: Explain the Ara3D.Ifc.Mesher parity gaps on the quick files and raise the scorecard
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Ifc.Mesher/**, deps/bim-open-data/tests/data/**, deps/bim-open-data/bench/ifc-mesher/**]
workflow: [W3]
---

## Acceptance criteria

- [ ] On `example.ifc`, the one product (of 116) whose bounds differ from web-ifc by more than 5 % is named, and either the mesher is fixed so `Example_SharedEntityBoundingBoxesMatchOracle` passes, or the ticket records that web-ifc is the one in error and the test is changed to say so
- [ ] On `steelplates.ifc`, the 4 of 14 products whose shapes differ from web-ifc are named with the cause measured on the file, and the triangle ratio (716 to 1,428 at the last run) is explained: a density choice, missing geometry, or a web-ifc artefact
- [ ] On `example.ifc`, the 28 of 116 products whose shapes differ are grouped by cause, from the file, not from earlier notes
- [ ] `bench/ifc-mesher/scorecard.json` and `RESULTS.md` are rerun and committed with the date after each change, and no quick-file parity drops below its last committed value

## Context

`bench/ifc-mesher/RESULTS.md` (run of 2026-10-11, mesher at bim-open-data `6f3a29c`, committed in `b367400`) has parity 0.963, 0.938, and 0.918 on `IfcOpenHouse_IFC4.ifc`, `example.ifc`, and `steelplates.ifc`, with every product meshed and the mesh and instance counts equal to web-ifc's. What remains is shape and triangle density on a minority of products. The mesher's July 2026 development notes were deleted in the layout work (TKT-216) because they were theories from mid-development; this ticket does not inherit them, and each criterion above is answered by reading the file and the two meshes, with the diagnostics under `tests/data/Ara3D.IfcMeshingComparison/Tests/Comparison/` (`DiagnoseExampleGaps`, `SurfaceDistanceTests`) and `Tests/Corpus/`. TKT-188 (AC20-FZK-Haus upper walls, measured against the BOS geometry on 2026-10-10) and TKT-190 (FM_ARC_DigitalHub triangle count 1.45 times web-ifc's, cause not measured) cover files outside this set. Split into one ticket per cause once the causes are known. Raised by reviews/2026-09-27-status.md; rewritten 2026-10-11.
