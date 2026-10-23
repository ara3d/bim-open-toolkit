# STEP mesher against OpenCascade, 2026-10-22

The 88 u-blox files of the 3D-Step-Models-Library meshed twice at a 0.1 mm chordal bound: by the Plato STEP mesher
(`Ara3D.StepBrep` at bim-open-data `1093b2e`, Plato `60134758`, through `step-corpus-harness gallery`) and by
OpenCascade 8.0.1's `BRepMesh_IncrementalMesh` (Python `cadquery-ocp`, linear deflection 0.1 mm absolute, angular
deflection 0.5 rad, parallel). Both meshes are measured against the exact B-rep as OpenCascade reads it; neither grades
the other. Method and scripts: `sandbox/step-brep-mesh/tools/occt-compare/README.md`. Per-file numbers:
`step-mesher-occt-comparison-2026-10-22.csv`.

**Where Plato meshes a face, its mesh is within the chordal bound of the exact surface on 87 of 88 files, and the one
exception is shared with OpenCascade. The accuracy gaps are missing faces, not wrong ones: three unmeshed planes cost
28% of ELLA-W1's area and 9% of LENA-R8's. Plato makes 19% fewer triangles than OpenCascade (median per file) and is
5.8 times slower (median per file).**

## Totals

| | Plato | OpenCascade |
|---|---|---|
| Faces (as each reader counts them) | 192,453 | 192,503 |
| Faces meshed | 192,446 | 192,471 |
| Triangles | 1,043,112 | 1,503,006 |
| Meshing time, sum over files (no file reading) | 243 s | 30 s |
| Median of each file's worst sampled deviation | 0.028 mm | 0.006 mm |
| Files with a sample over the 0.1 mm bound | 1 (MAYA-W260_REVC) | 1 (MAYA-W260_REVC) |
| Files whose area is more than 0.1% under the exact area | 13 | 2 (ANN-MB2, MAYA-W260_REVC) |

Deviation is measured at 20,000 points sampled by area inside each file's triangles, each projected onto the exact
surface of the nearest face. Plato uses more of the chordal budget than OpenCascade: it refines on the chordal bound
alone, while OpenCascade's 0.5 rad angular deflection adds triangles on small-radius features well before the chordal
bound is reached.

## Findings

1. **Unmeshed faces are the largest accuracy loss.** ELLA-W1 faces 304 and 305 (planes; "segments on this edge come
   closer than the parameter tolerance to another boundary") are 432 mm² of 1,547 mm²; 3,339 of 20,000 points sampled
   on OpenCascade's mesh are more than 0.1 mm from the Plato mesh, up to 1.1 mm. LENA-R8 face 258 is 647 mm² of
   7,062 mm². These are the faces the late corpus report lists as waiting on v1-edges' E5c.
2. **Chordal-only refinement loses area on small spheres.** IRIS-W1x1, IRIS-W1x6 and NORA-B120, B121 and B126 are
   0.6% to 0.85% short of the exact area with every sample inside the bound (IRIS-W1x1: worst 0.079 mm, 99th
   percentile 0.030 mm, against OpenCascade's 0.008 and 0.0026). Their 132 to 154 sphere faces are small enough that a
   chord 0.1 mm off the surface cuts a large share of each one. This meets the contract; a relative or angular bound
   would close it if area matters.
3. **At 0.1 mm Plato's own contract check fails on M2_JODY-W5 and W6 CARD**: B-spline faces 321, 443 and 583 deviate
   0.30 mm against a 0.10 mm bound. The late corpus run, at the default 1 mm bound, passes this file. The sampled
   comparison here missed it because the three faces are small and sampling is by area; Plato's per-face check is
   the sharper test for under-refined small faces. ANN-MB2 and c211_case_with_odin_v1 break the contract as in the
   late report.
4. **MAYA-W260_REVC exceeds the bound in both meshes** (Plato 0.60 mm at 41 samples, OpenCascade 0.82 mm at 92), so
   the cause is the model or the nearest-face locator rather than either mesher. OpenCascade also reads 16 more faces
   in this file and 15 more in each of the other two MAYA REVC files; not investigated. The four-face difference on
   M2_JODY-W5 and W6 CARD is J7's removal of zero-thickness double sheets.
5. **Placement agrees everywhere**: the bounding boxes of the two meshes match to 0.01 mm on all 88 files, including
   metre-unit ODIN-W260 and the assemblies.
6. **Speed.** Per file Plato's meshing time (tables to assembly, warm, `--parallel`) is 0.9 to 67 times
   OpenCascade's, median 5.8. The worst ratios are c211_case_with_odin_v1 (60.0 s against 0.9 s) and JODY-W3 (5.5 s
   against 0.16 s). The machine was shared with other sessions, so the absolute times are loose.

## What the method cannot see

- Area-weighted sampling under-samples small faces (finding 3). A per-face sample count would fix it.
- The nearest face is chosen through OpenCascade's mesh, and the distance is to that face's untrimmed surface, so a
  point beside a face boundary can be measured against the neighbouring surface.
- OpenCascade's angular deflection was left at its default. A run with a large angular deflection would compare the
  two on the chordal bound alone.
