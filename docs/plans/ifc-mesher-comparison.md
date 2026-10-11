# Five IFC meshers compared from stored mesh dumps

Ticket TKT-225. Workflow 3 of `PROJECT.md` (the answer in every form: a picture of the model is only as good as its mesh) and the benchmark principle of workflow 5: a claim about the pure C# mesher means nothing without another mesher's number beside it. Asked by the owner on 2026-10-11: "compare the new mesher with four other IFC meshers ... we don't run them all the time ... outputs need to be stored somewhere ... tests need to run fast."

## The five meshers

| Name in the harness | What it is | How it runs |
|---|---|---|
| `Ara3D.Ifc.Mesher` | The pure C# mesher in `src/data/Ara3D.Ifc.Mesher` | In process (exists: `IfcMesherBackend`) |
| `WebIfcDll` | The Ara3D C# wrapper around an older web-ifc C++ build, `web-ifc-library.dll` in `Ara3D.IfcLoader` | In process (exists: `WebIfcBackend`) |
| `WebIfc` | web-ifc 0.0.78 from npm, the engine under ThatOpen components 3.4.x | Node script, on demand |
| `IfcLite` | IFClite's exact-CSG geometry, `ifclite-geom` 4.15.0 from PyPI | Python script, on demand |
| `IfcOpenShell` | IfcOpenShell 0.8.5, its `ifcopenshell.geom` iterator | Python script, on demand |

ThatOpen components is a viewer library over web-ifc; its meshing is web-ifc's, so the engine is what is compared. IFClite also ships a CLI with GLB export, but only its LOD1 path keeps express ids; the Python wheel gives per-element meshes keyed by STEP id directly, so the wheel is used.

## Acceptance criteria

1. Each mesher is an `IMeshingBackend`. The three external ones never run inside a test: a script, `bench/ifc-mesher/meshers/run.mjs`, runs them over a list of model files and writes one mesh dump per mesher per model, with the tool's version, the input file's SHA-256, and the time taken.
2. A mesh dump is one file in a format a dozen lines of JavaScript or Python can write and C# can read into a `Model3D`: meshes with points and triangles, instances with an entity id, a mesh index, and a matrix. Dumps for the three quick files (`IfcOpenHouse_IFC4.ifc`, `example.ifc`, `steelplates.ifc`) from every external mesher are committed under `bench/ifc-mesher/dumps/`, under 2 MB in all, so the comparison runs on a fresh checkout with none of the external tools installed. Dumps for other models go under the git-ignored `artifacts/ifc-mesher/dumps/`.
3. `dotnet test tests/data/Ara3D.IfcMeshingComparison` includes a test that compares every pair of the five meshers on the quick files from the committed dumps and the two in-process backends, in under 30 seconds on the owner's machine, and ignores itself for a pair whose dump is missing.
4. `bench/ifc-mesher/RESULTS.md` gets a dated section with, per quick file, a row per mesher (triangles, meshes, instances, bounds, time, tool version) and the parity matrix (every mesher scored against every other with `ModelComparer`), and `bench/ifc-mesher/meshers.json` holds the same numbers for a machine.
5. The bench README says how to install the three external tools, how to rerun the dumps, and that a dump is only regenerated when the model's hash or the tool's version changed.

## Design

**Mesh dump** (`Harness/MeshDump.cs`): a binary file `<model>.meshdump`. Header: ASCII `MDMP`, int32 version 1, int32 JSON length, UTF-8 JSON (`mesher`, `mesherVersion`, `source` {`fileName`, `sha256`, `bytes`}, `elapsedMs`, `generatedUtc`, `meshes` [{`points`, `triangles`}], `instances` [{`entity`, `mesh`, `matrix` (16 floats, translation at 12, 13, 14, the layout `System.Numerics`, IfcOpenShell, and web-ifc share)}]). Body: for each mesh in order, `points` × 3 float32, then `triangles` × 3 int32. Lengths in metres. `MeshDump.Read(path)` returns a `MeshDumpHeader` and a `Model3D`; `MeshDump.Write(path, header, model)` is the C# side of the round trip and what the in-process backends use when a dump of them is wanted.

**Backends** (`Meshers/DumpBackend.cs`): `DumpBackend(name, folder)` implements `IMeshingBackend` by reading `<folder>/<model>.meshdump`; `Build` returns `MeshingResult.Failed` with the message "no dump" when the file is absent, and the comparison test turns that into `Assert.Ignore`. `Meshers/MesherCatalog.cs` lists the five with their names and descriptions, looking for dumps first in `bench/ifc-mesher/dumps/<name>/` and then `artifacts/ifc-mesher/dumps/<name>/`.

**Adapters** (`bench/ifc-mesher/meshers/`): `webifc/mesh.mjs` (web-ifc `IfcAPI`, `StreamAllMeshes`, one mesh per geometry express id, instances from `placedGeometries`), `ifcopenshell/mesh.py` (the iterator with world coordinates off, so instances carry the product matrix; one mesh per product), `ifclite/mesh.py` (`geometry_data_buffers`; world coordinates, identity matrices). `run.mjs` takes `--models <file>...` (default: the quick files found through `ARA3D_IFC_TEST_DIRS`) and `--out committed|artifacts`, installs nothing, checks each tool's version, skips a dump whose header already has the same source hash and tool version, and prints a table. Package files: `package.json` (web-ifc 0.0.78 pinned) and `requirements.txt` (ifclite-geom 4.15.0, ifcopenshell 0.8.5).

**Matrix and results** (`Harness/MesherMatrix.cs`, `Tests/Comparison/MesherMatrixTests.cs`): for each quick file, build or load each mesher's `Model3D`, compute `ModelStats`, and `ModelComparer.Compare(a, b)` for every ordered pair (the metrics are not symmetric: the second model is the oracle). `WriteMeshersJson` writes `bench/ifc-mesher/meshers.json`; `FormatMarkdown` writes the RESULTS.md section. One `[Explicit]` test writes the files; one default test asserts every pair scores and runs in time.

## Considered and rejected

- **glTF as the interchange.** Every tool can write it, but IFClite's `export --format glb` drops express ids, web-ifc has no writer, and the C# side has a glTF writer (`Ara3D.BimOpenSchema.IO.Gltf`) but no reader to `Model3D`. A purpose-built dump is smaller and keeps the entity id.
- **BFAST, the oracle's format.** Readers and writers exist only in C#.
- **Running the external tools from the tests.** Node and two Python packages on every machine, minutes per model on the larger files, and results that change when a tool updates. Stored dumps make the comparison a read, and the committed quick-file dumps make it run in CI.
- **Putting this in `bim-open-bench`.** That repository's README plans a `geometry` suite for exactly this, but it holds nothing yet; the harness, metrics, and oracles are here. Move it when `bim-open-bench` gets its first suite, and note that in its README.
- **ThatOpen `@thatopen/fragments` as the output.** Fragments is a viewer format; converting it back to meshes adds a step and changes nothing about the geometry, which is web-ifc's.

## Chunks

| Id | One-sentence commit | Fence | Test |
|---|---|---|---|
| M1 | `MeshDump` read and write, `DumpBackend`, `MesherCatalog`, `TestFiles.DumpsDir`s | `tests/data/Ara3D.IfcMeshingComparison/{Harness/MeshDump.cs,Meshers/DumpBackend.cs,Meshers/MesherCatalog.cs,Harness/TestFiles.cs,Tests/Comparison/MeshDumpTests.cs,Tests/Comparison/BackendSmokeTests.cs}` | round trip of a snippet-built model through a dump; the catalog names five backends |
| M2 | The three adapters and `run.mjs`, with pinned package files; dumps for the quick files committed | `bench/ifc-mesher/meshers/**`, `bench/ifc-mesher/dumps/**`, `.gitignore` | `run.mjs` over the quick files writes nine dumps the C# reader loads |
| M3 | `MesherMatrix` and its tests; `meshers.json` and the RESULTS.md section; README | `tests/data/Ara3D.IfcMeshingComparison/{Harness/MesherMatrix.cs,Tests/Comparison/MesherMatrixTests.cs}`, `bench/ifc-mesher/{meshers.json,RESULTS.md,README.md}` | the default test runs under 30 s; the Explicit test writes the files |
| M4 | Toolkit: pin bim-open-data, close TKT-225, build log | `deps.json`, `tickets/TKT-225-*.md`, this file | `node deps.mjs --check` |

M1 first; M2 and M3's code are independent of each other, but M3's results need M2's dumps.

## Extension points

- The dumps of the two in-process meshers can be written too (`MeshDump.Write`), which would let `bim-open-bench` compare all five without .NET.
- Larger models (Duplex, DigitalHub, Schependomlaan) run through `run.mjs --out artifacts`; a per-model timing table would join `meshers.json` when the Snowdon-size claim needs a number.
- `ModelComparer`'s metrics assume the second model is the trusted one; a symmetric score (mean of both directions) would read better in a matrix.

## Build log

- 2026-10-11, M1 `8cf6f2b`: MeshDump, DumpBackend, MesherCatalog; round-trip test. Two struct pitfalls: `FilePath` is a struct, so `FirstOrDefault` returns an empty path, not null, and `Matrix4x4.M41` is a `Number`, so a test compares `(float)` of it.
- 2026-10-11, M2 `814ead9`: adapters, `run.mjs`, nine quick-file dumps (1.2 MB) committed. The three tools were all present or installable here (`npm install`, `pip install ifclite-geom==4.15.0`).
- 2026-10-11, M3 `75c067d`: MesherMatrix and tests; `meshers.json`; RESULTS.md matrix. The first web-ifc dumps were Y-up (web-ifc's three.js frame): `SetGeometryTransformation(identity)` did not change `StreamAllMeshes` output, so the adapter rotates each placement back to Z-up itself. The default test took 36.5 s serially and 7.2 s with the pairs compared in parallel (`AsParallel`). Results: the two web-ifc builds agree at 0.988 to 0.997, IFClite and IfcOpenShell at 0.964 to 0.997, the C# mesher 0.92 to 0.96 against both; three count differences are recorded as unexplained.
- 2026-10-11, M4: toolkit pins bim-open-data `75c067d`; TKT-225 closed. Follow-ups worth a ticket when someone picks them up: the three unexplained count differences in RESULTS.md, and running the larger models (Duplex, DigitalHub, Schependomlaan) through `run.mjs --out artifacts` for a timing table.
- 2026-10-11, plan written; TKT-225 filed. IfcOpenShell 0.8.5 is installed and its iterator meshes IfcOpenHouse in 0.2 s; web-ifc 0.0.78 and ifclite-geom 4.15.0 are the current releases (checked on npm and PyPI).
