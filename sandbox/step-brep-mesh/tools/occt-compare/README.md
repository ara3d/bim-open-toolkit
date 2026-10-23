# Plato mesher against OpenCascade

An experiment: mesh the same STEP files with the Plato STEP mesher (`Ara3D.StepBrep` through `step-corpus-harness`) and
with OpenCascade's `BRepMesh_IncrementalMesh`, and measure both against the exact B-rep that OpenCascade reads. The two
meshes are not expected to match triangle for triangle. The question is whether the Plato mesh is as accurate.

## What is measured

| Measure | How |
|---|---|
| Deviation from the exact surface | Points sampled uniformly inside each mesh's triangles (vertices lie on the surface by construction, so chordal error lives inside), each projected with `GeomAPI_ProjectPointOnSurf` onto the surface of the face whose OpenCascade triangle is nearest. Reported as max, 99th percentile, and the count over the chordal bound. |
| Coverage | Points sampled on OpenCascade's mesh, and their distance to the Plato mesh. A distance well over the chordal bound marks a region the Plato mesh leaves out, such as an unmeshed face. |
| Area | Each mesh's area against `BRepGProp::SurfaceProperties`, relative error. |
| Size and time | Triangle counts; meshing time without reading (Plato: tables to assembly, warm; OpenCascade: `BRepMesh_IncrementalMesh`, parallel). |
| Placement | The largest gap between the two bounding boxes' corners, which catches unit or assembly-placement disagreements. |

OpenCascade's mesh is meshed with the same linear deflection as Plato's chordal bound, absolute, and its default
angular deflection of 0.5 rad. Plato refines on the chordal bound alone.

## Running it

```bash
python -m venv <venv>
<venv>/Scripts/python -m pip install -r requirements.txt
dotnet build deps/bim-open-data/tools/step-corpus-harness -c Release --artifacts-path <artifacts>
<venv>/Scripts/python run_corpus.py <artifacts>/bin/StepCorpusHarness/release/step-corpus-harness.exe <corpus> <out> --chordal 0.1
```

`compare.py <file.step> <plato.glb> <out.json>` compares one file whose GLB the harness's `gallery` mode wrote.
`run_corpus.py` writes `<out>/summary.csv`, one row per file, and keeps each file's GLB and comparison JSON; it skips
files already compared, so a stopped run resumes.
