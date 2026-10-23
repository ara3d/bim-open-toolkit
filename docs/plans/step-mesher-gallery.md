# STEP mesher gallery

Written 2026-10-21 at the owner's request: a gallery of meshing results, successful and failed, that stand for the challenges of a complete STEP mesher. The page is the artifact **STEP Mesher Gallery** (https://claude.ai/artifact/MvSKq4pnsqHmoX1arp7mhK, private until shared): a three.js viewer, 27 cases on 2026-10-21 and 33 since 2026-10-22, each a GLB meshed by the corpus harness's new `gallery` mode (bim-open-data `94d4d67`) from the library compiled at bim-open-toolkit `8984df4b`, the same build as `docs/plans/step-mesher-corpus-2026-10-21.md`. Faces are coloured by surface kind, every discretized edge is a thin line, and the edges of unmeshed faces are red, so a hole in a part shows its outline.

## The cases

| Group | Case | Verdict | Ticket | What it stands for |
|---|---|---|---|---|
| Witness | Unit box, cylinder, sphere, torus, cone | meshed, closed | TKT-314, 324, 325 | the seam cut, poles, a chart closed both ways, the apex |
| Witness | Block with a through hole, hollow box | meshed, closed | TKT-328 | genus and voids |
| Witness | Box with a flipped face | caught: 4 misoriented edges | TKT-328 | the checks find a defect in the file |
| Witness | Two boxes sharing a corner | edge checks pass | TKT-328 | a pinched vertex only the vertex-component check sees |
| Witness | Bump solid, bump 0.3 | **meshed wrong** | **TKT-415** (new) | the quad grid flattens a four-edge B-spline face: the mesh hash equals the unit box's |
| Part | EMMY-W1, NINA-B400, ODIN-W160 | meshed, closed, oriented | TKT-323, 409 | real antennas and modules, under a second each; ODIN-W160 hung for 358 s on Oct 19 |
| Part | ODIN-W260's two 212-edge planes | meshed, slow | TKT-349 | 1.2 s for 2,328 triangles, the slowest plane |
| Part | ODIN-W260's slowest cylinder faces | meshed, slow | TKT-349 | 12-edge cylinder faces by CDT, about 1.3 s each |
| Failure | LENA-R8, LARA, RCB-F9T, M2-ZED-F9T, NORA-B100 | faces missing | TKT-410 | the compiler stub on B-spline edges; red outlines around every hole |
| Failure | LENA-R8 sphere faces, M2-ZED cone face 753, MAYA cylinder faces | library threw | TKT-411 | three-edge (and eight-edge) loops that throw an index error, shown with their neighbours |
| Failure | MAYA-W260_REVC and its 12-edge planes, ODIN-W260 and its four planes | not simple | TKT-412 | boundary segments within the UV tolerance of each other |
| Failure | MAYA-W260_REVC | non-manifold and misoriented edges | TKT-413 | the only files whose meshed faces disagree on an edge |

Not shown: ELLA-W1, where every edge throws the stub and no face meshes, and NINA-B222-W1x2, which does not finish edge discretization (TKT-414).

## What it found

`witness:BSplinePatchSolid:0.3` at chordal 0.01 meshes to six quads with digest `AC03233177AEA985`, the unit box's. The B-spline top face takes the grid branch and becomes the one quad through its corners; the chordal bound is tested along the straight boundary edges, where it is zero, so the interior bump is invisible. Filed as TKT-415; TKT-401 (the bump solid's degenerate element) is the nearby defect, and TKT-405 (prefer quads) is the decision that routes four-edge faces to the grid.

## Rerun of 2026-10-22

The gallery was regenerated on the library generated from toolkit c47db0b3 (bim-open-data 58f6fcb), which adds TKT-406, TKT-407 and TKT-408 to the 2026-10-21 build. The fixes made on 2026-10-22 for TKT-410, TKT-411, TKT-413 and TKT-415 sat in `sandbox/step-mesh-staging/` and were not in that library, so they do not show. Two other corpus runs shared the machine, so whole-file times are not compared.

| Measure | 2026-10-21 | 2026-10-22 |
|---|---|---|
| Witness meshes | 10 | 10, byte for byte the same |
| Faces meshed in the 10 corpus files | as listed | unchanged; no failure fixed |
| ODIN-W260 face 2584 (cylinder, 12 edges) | 1,296 ms, 958 triangles | 82 ms, 806 triangles |
| ODIN-W260 face 34 (plane, 212 edges) | 1,216 ms | 200 ms, same 2,328 triangles |
| ODIN-W160 triangles | 29,104 | 27,864 |

Yesterday's ODIN-W260 sidecar came from a cold run, but JIT compilation cannot account for a 6 to 16 times drop on five separate faces. Six public samples were added. STEP Tools io1-tc-214 (the epic's AP214 criterion), NIST FTC 06 and STEP Tools cubcylso mesh closed. NIST CTC 01 and STEP Tools block lose faces to TKT-410; block's lines are wrapped in INTERSECTION_CURVE. The moon buggy's full spheres refine to about 19,000 triangles each, and its assembly has 180 misoriented edges; the gallery shows three of the spheres because the whole mesh exceeds the host's 16 MB file limit. STEP Tools clip.stp decodes to no faces because it uses entity short names (TKT-422). NASA's RASSOR did not finish its 78,659 edges in 150 s and is left out.

## First-level operations, 2026-10-22 (evening)

The owner asked for cases between the primitives and the whole parts: the operations a modeller makes in one step. They are Plato witnesses, not STEP files, so the library's laws run on them too (TKT-482; the Python STEP writer tried first covered the decoder but tested nothing, and was dropped). Twenty-two `Witness_<Name>` values in `sandbox/step-mesh-staging/gallery-witnesses/` (staged for the v1 supervisor's merge, TRACK.md there): hexagon, L bracket, chamfer, fillet, the same fillet as a surface of linear extrusion, inner fillet, slot, D-shaft, pyramid, blind hole, boss, counterbore, countersink, spherical dimple and dome, shelled open box, tube, oblique cut (an ellipse edge), torus-filleted puck, revolved barrel and cone (surfaces of revolution), and a cross hole whose two intersection curves are cubic B-splines through 97 points each (`tools/cross_hole_spline.py`; 3.5e-7 off the cylinders, inside the 1e-6 tolerance). Each states its counts, genus and volume; seven laws check them and each is a `MeshedWitness`.

The gallery got an **operations** group whose verdicts come from the sidecar (`auto_verdict`: what did not mesh and why, else closed, oriented, contract), and a status table at the top: per group, cases, passes, faces meshed of drawn, triangles and face time. The run below used a scratch regeneration (2ab7ea1a's layers plus the staged files, Plato 60134758) built under `artifacts/`, never committed to bim-open-data, since the v1-close session owns the committed regeneration and its pin.

| Group | Cases | Pass | Faces meshed | Triangles | Face time |
|---|---|---|---|---|---|
| Primitives | 10 | 9 | 59 / 59 | 13,488 | 12.3 s |
| First-level operations | 22 | 21 | 143 / 144 | 5,578 | 19.9 s |
| Real parts | 5 | 3 | 4,884 / 4,884 | 38,413 | 12.0 s |
| Public samples | 6 | 3 | 346 / 360 | 130,528 | 27.8 s |
| Failures | 12 | 0 | 25,504 / 27,906 | 126,179 | 72.9 s |
| All | 55 | 36 | 30,936 / 33,353 | 314,186 | 144.9 s |

Face time for witnesses and operations is a cold process each (no `--warmup`), so most of the 20 s is JIT: the parts themselves mesh in under 100 ms. What the operations found:

- 21 of 22 mesh closed and oriented with the contract holding, the surfaces of revolution and linear extrusion among them (first time either is meshed in the gallery).
- The cross hole's outer band, with two closed B-spline loops, is refused as not simple (the TKT-412 family): 3 of 4 faces mesh, 576 boundary edges. A closed edge on an aperiodic B-spline also needs layer 3's closure mark, or its domain is empty (`TraversalDomain`); the witness supplies it, as `PrepareModel` does for a file.
- `Oracle_DivergenceVolume` returns NaN on a surface of revolution or linear extrusion (TKT-483): the volume law holds vacuously on those three until it is fixed; the other 19 match their closed forms.
- Two compiler facts: a function named `At` becomes indexing in the C# (`3.4[2.4]`), and the law interpreter reads a function named like its own library as that library.

## How to regenerate

```
dotnet build deps/bim-open-data/tools/step-corpus-harness -c Release --artifacts-path artifacts/builders/<id>
python deps/bim-open-data/tools/step-corpus-harness/gallery-page.py run artifacts/step-gallery --harness <artifacts path>/bin/StepCorpusHarness/release/step-corpus-harness.exe   # --only o-Hexagon,... for the operations alone
python deps/bim-open-data/tools/step-corpus-harness/gallery-page.py page artifacts/step-gallery --previous artifacts/step-gallery/<earlier run> --label "<library and date>"
```

Before a run, copy the folder's `.json` files into a dated subfolder; that is the next page's `--previous`. Each case's source and flags live in the script's case table, so `run` remakes every GLB and sidecar, and `--only stem,stem` remakes a few. `page` writes `index.html` plus a base64 `.glb.txt` beside each GLB, because the artifact host serves text and images but not `model/gltf-binary`, and a text file there may not exceed 16 MB. The folder `artifacts/step-gallery/` is git-ignored; `.claude/launch.json`'s `step-gallery` entry serves it on port 8777. To republish, publish `artifacts/step-gallery/index.html` to the artifact URL above with the `.glb.txt` files. The corpus is `C:\Users\cdigg\git\3d-format-shootout\data\submodules\3D-Step-Models-Library`; the public samples come from `scripts/fetch-step-samples.ps1`.

The gallery is a snapshot of one build: after a merge that regenerates `Ara3D.StepBrep`, run it again.
