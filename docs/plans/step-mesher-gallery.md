# STEP mesher gallery

Written 2026-10-21 at the owner's request: a gallery of meshing results, successful and failed, that stand for the challenges of a complete STEP mesher. The page is the artifact **STEP Mesher Gallery** (https://claude.ai/artifact/MvSKq4pnsqHmoX1arp7mhK, private until shared): a three.js viewer with 27 cases, each a GLB meshed by the corpus harness's new `gallery` mode (bim-open-data `94d4d67`) from the library compiled at bim-open-toolkit `8984df4b`, the same build as `docs/plans/step-mesher-corpus-2026-10-21.md`. Faces are coloured by surface kind, every discretized edge is a thin line, and the edges of unmeshed faces are red, so a hole in a part shows its outline.

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

## How to regenerate

```
dotnet build deps/bim-open-data/tools/step-corpus-harness -c Release --artifacts-path artifacts/builders/<id>
<harness> gallery <file.step> out.glb --parallel --warmup
<harness> gallery witness:Cylinder out.glb --parallel --chordal 0.01
<harness> gallery <file.step> out.glb --faces 202,203,204 --ring 1 --parallel
python deps/bim-open-data/tools/step-corpus-harness/gallery-page.py artifacts/step-gallery
```

The harness's README lists the flags. `gallery-page.py` holds the case table (stem, group, verdict, ticket, title, sentence) and writes `index.html` plus a base64 `.glb.txt` beside each GLB, because the artifact host serves text and images but not `model/gltf-binary`; the page decodes the text and hands the bytes to `GLTFLoader.parse`. The GLBs and the page live in `artifacts/step-gallery/` (git-ignored); `.claude/launch.json`'s `step-gallery` entry serves that folder on port 8777 for a local look. To republish, publish `artifacts/step-gallery/index.html` to the artifact URL above with the `.glb.txt` files.

The corpus is `C:\Users\cdigg\git\3d-format-shootout\data\submodules\3D-Step-Models-Library`. After the next corpus-changing merge (TKT-410 above all), rerun the commands and republish: the gallery is a snapshot of one build, not a live view.
