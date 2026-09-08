# Track F2 checkpoint — formats on the M1.2 columns

State **verified**. Contract M1 with the **M1.2 additions**. Fence `viewer/packages/formats/**` less its four supervisor-owned config files; nothing outside written, Track F's work extended not rewritten. Sub-agents 0, escape hatches added 0, tests 149 to 155. Blockers none, remaining work in this fence none.

| # | Chunk | Commit |
|---|---|---|
| 1 | `Geometry.meshTable` filled from the file's own buffers, `meshes` left empty | `f359b0b` |
| 2 | Hidden placements kept as rows with `visible` 0 | `53d10c5` |
| 3 | `roughness` and `metallic` read from the flags word | `213f964` |
| 4 | Measurement, `docs/formats.md`, `README.md`, this file | this commit |

## Delivered

- **`bfastMeshTable`** replaces `bfastMeshes`: `positions` and `indices` are the file's own buffers, the cost is four `Int32Array`s and one pass, and the bounds column is the file's stored boxes as they are, copied with the unusable ones emptied only when one is not finite or has no vertices. No `Mesh` record is built. glTF, OBJ and STL keep their `Mesh` lists and build no table, since each parser makes a separate buffer per mesh and a table would copy every vertex again; `docs/formats.md` states both and why.
- **Every placement is a row**, hidden ones with `visible` 0, so hiding is a column write; `representation` names the first placement with geometry hidden or not, because hiding is state a host changes. `roughness` and `metallic` come from the two high flag bytes. Each column is allocated on the first row differing from the default, so a file saying nothing new allocates none.
- **`validateLoadedModel`** takes a table-only geometry: column lengths, a bounds row per mesh, ranges inside their buffers, indices inside their own mesh's vertices, and the two forms agreeing when both are present. `modelStatistics` counts either form and gains `hiddenInstances`.

## Measurements

Method as Track F, machine as busy: Node 22.13.1, Windows 11, 58 percent CPU, 13 node processes, warm-up then five repetitions, medians, two runs.

| Step, ms | F before | F2 run 1 | F2 run 2 |
|---|---:|---:|---:|
| mesh step | 73 to 94 | **24.2** | **24.7** |
| instance columns | 93 to 105 | 86.2 | 79.4 |
| whole load, metadata full | 353 to 455 | **315.7** | **283.0** |
| whole load, metadata none | 268 to 296 | 193.3 | 184.0 |
| `validateLoadedModel` | 128 to 153 | 112.3 | 110.9 |
| prepare the BOS archive, code untouched | 1650 to 1686 | 1485.5 | 1380.8 |

The mesh step is three times faster, dropping 171,569 `Mesh` records and the roughly 850,000 objects they hold for four typed arrays; the instance columns are faster while carrying 3.3 percent more rows. The whole-load rows are not purely comparable: the untouched conversion step is 12 to 16 percent faster here than in F's runs, which is the honest machine error bar, so the mesh step's 50 to 70 ms is the gain and the rest is a quieter machine. A 5,781 ms first sample in run 1, taken while another track compiled, was discarded by the median.

Changed by design: instances 456,598 to **471,462**; `geometryFreeObjects` 28,976 to **25,464**, since 3,512 objects draw only hidden geometry; `formats/dropped-hidden-instances` (warning) is now `formats/hidden-instances` (info). Tests: the hidden-placement test asserts two rows not one; three `bfastMeshes` tests became `bfastMeshTable`; five `modelStatistics` expectations gained `hiddenInstances`; the fixture writer's unspecified placement now writes roughness byte 255, the byte meaning the contract default, so a test opts in to a material.

## Findings and the one request

1. **`render` and `testing` read `geometry.meshes` only** — `render/src/instance-table.ts` 155, 179, 301 and `testing/src/headless/scene.ts` — so a table-only geometry gives them no meshes. BFAST is the default format, so this must land before a BFAST model draws: read `meshCount(table)` and `meshAt(table, i)` when `meshTable` is defined. Outside this fence; **to the supervisor, for Track R**. No contract addition is needed, M1.2 covered every request Track F made.
2. The file's per-mesh boxes are laid out exactly as `MeshTable.bounds` wants, so the bounds column is shared and not copied. Visibility for the whole model is 471 KB, allocated only when the file hides something.
3. M3's finding held exactly: `meshTableFrom` is right for a parser that builds per-mesh buffers, wrong for a loader reading a file that is already columnar.

## Verification, from `viewer/`, and tooling

| Command | Result | Runs | Real defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit -p packages/formats/tsconfig.json` | pass, no output, 8 to 12 s | 6 | 2, mechanical: both call sites of the renamed `bfastMeshes`, one in the performance suite that no other check reaches before a 20 s run | `exactOptionalPropertyTypes` makes each new optional column a conditional spread; `noUncheckedIndexedAccess` puts `?? 0` on every hot-loop read, as for F and M3 | helpful |
| `eslint packages/formats` | pass, no output, 25 to 30 s | 4 | 0 | nothing fired in four runs, on the slowest gate here by three times | hindrance at this size |
| `npm test -w @bim-open-toolkit/formats` | pass, 11 files, 155 tests, 1.1 to 1.3 s | 8 | 1, real: the fixture writer's default roughness byte of 0 gave every fixture a roughness column of zeros, which is what the "column only when a row differs" rule exists to prevent | a 5 s import costs five times the tests | helpful; found the only design mistake |
| `npm run perf -w @bim-open-toolkit/formats` | pass, 2 tests, 20 and 29 s | 2 | 0, but it is the only evidence the track was worth running, and it caught its own 5,781 ms outlier by printing every sample | needs the model; ran against 13 other node processes, which is why the untouched conversion step is the error bar | helpful; the only check that measured the point |
| `tsc --noEmit -p packages/render/tsconfig.json` | pass, read-only downstream, 7 s | 2 | 0 by compiling, 1 by reading: finding 1, which types cannot catch because `meshes` is still there and still an array | a green downstream type check is not evidence a downstream reader works | neutral: cheap, narrower than it looks |
| escape-hatch scan over `src` and `test` | pass, under 1 s | 2 | 0 | prose "as" and "any" match | cheap, keep |
