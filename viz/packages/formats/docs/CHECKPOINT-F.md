# Track F checkpoint — formats

State: **verified** (all five chunks committed and green).
Contract revision in force: **M1** at `641624b` (`viewer/packages/model/docs/CONTRACTS-M1.md`). Acknowledged.
Fence: `viewer/packages/formats/**` except `package.json`, `tsconfig.json`, `tsconfig.build.json`,
`vitest.config.ts`, `vitest.perf.config.ts`, which are supervisor-owned. Nothing outside was written.

Nested sub-agents spawned: **0**. The mechanical work the brief offered to a Sonnet delegate (porting
alpha loader tests, fixture files) turned out not to exist as a separable task: the alpha loader
tests cover the loaders package's own output shapes, not this package's, and the fixtures had to be
designed alongside the adapters. Writing them directly was cheaper than specifying them.

## Chunks

| # | Concern | Commit | Files |
|---|---|---|---|
| 1 | `LoadedModel` contract, detection, resolver, progress, diagnostics | `8c4f530` | `src/{loaded-model,detect,resolver,progress,diagnostics}.ts`, four test files, `test/fixtures.ts` |
| 2 | BFAST as the default path, BOS through conversion to it | `4617096` | `src/{bfast,bos}.ts`, `test/{bfast,bos}.test.ts` |
| 3 | Measurement on the real model, and the hot-loop fix it found | `ebbfeaa` | `test/perf/**`, `src/{bfast,diagnostics,loaded-model}.ts` |
| 4 | glTF, OBJ and STL adapters | `36c441b` | `src/{gltf,obj,stl}.ts`, three test files |
| 5 | The `loadModel` entry, docs and this checkpoint | `5325138` | `src/load.ts`, `test/load.test.ts`, `README.md`, `docs/**` |

## Delivered

`loadModel(source, options)` is the one entry. It resolves the source, detects the format, dispatches,
reports progress, honours cancellation, and returns `Result<LoadedModel>`. It never throws, including
on cancellation.

- **`src/loaded-model.ts`** — the type and its invariants. `LoadedModel` is `ModelData` plus
  `Geometry` plus `CoordinateContext` plus diagnostics, with `coordinates` the same object as
  `data.coordinates` so the two cannot disagree (the validator checks it). `validateLoadedModel`
  walks every index and every float from the outside; `modelStatistics` counts a model in one pass.
- **`src/detect.ts`** — signature first, name second, and a note saying which answered. BFAST, ZIP,
  GLB, binary STL by exact length, ASCII STL, glTF JSON, OBJ statements.
- **`src/resolver.ts`** — URL, `URL`, `ArrayBuffer`, view, `Blob` and `File` sources; streamed fetch
  with byte progress and mid-stream cancellation; an HTML response rejected by name. `Resolver` is
  how a host supplies a file a document names but does not contain; the default refuses every one.
- **`src/progress.ts`**, **`src/diagnostics.ts`** — one progress vocabulary (`fetch`, `parse`,
  `convert`, `metadata`) and one code set. Every failure and every loss has a code and a path.
- **`src/bfast.ts`** — the default path. Straight from the loaders' render tables to the columnar
  `Geometry`: mesh positions and indices are views on the file, and instances are four allocations
  for the whole model. Objects are the embedded entity table's rows when there is one, so
  geometry-free objects survive; names and categories are read from the embedded BOS tables.
- **`src/bos.ts`** — `bosToBfast` then the BFAST path, with the conversion injectable so the
  composition is testable without an archive.
- **`src/gltf.ts`**, **`src/obj.ts`**, **`src/stl.ts`** — pure parsers, no three, no viewer-core.
- **`docs/formats.md`** — the format table: what each format carries, what is lost, what is assumed.

2,000 lines of `src`, 1,886 of `test`, 149 tests.

## Measurements

Node 22.13.1, Windows 11, warm-up then five repetitions (three where an archive is prepared), medians.
Reference model: the private prepared Snowdon BFAST (111,630,208 bytes) and its BOS archive
(9,362,255 bytes). No model bytes are committed. Regenerate with `npm run perf`; the numbers land in
`docs/measurements-bfast.md` and `docs/measurements-bfast-versus-bos.md`.

Two runs an hour apart, with different numbers of other agents on the machine, are given because the
spread between them is the honest error bar: the second run is 5 to 20 percent faster throughout.

| Step | Median ms, first run | Median ms, second run |
|---|---:|---:|
| parse container and render tables | 88 | 83 |
| decode entity ids, names and categories | 102 | 87 |
| decode entity ids only | 21 | 20 |
| object rows | 5 | 8 |
| mesh list as views on the file | 94 | 73 |
| instance columns | 105 | 93 |
| **whole load, metadata full** | **455** | **379** |
| whole load, metadata none | 296 | 268 |
| `validateLoadedModel` over the whole model | 128 | 153 |

| Whole load | Median ms, first run | Median ms, second run |
|---|---:|---:|
| prepare the BOS archive as BFAST | 1650 | 1686 |
| **BFAST** | **353** | **394** |
| **BOS, including preparation** | **2082** | **2126** |

The model: 51,139 objects (28,976 with no drawn geometry), 171,569 meshes, 456,598 instance rows,
14,864 further placements marked hidden and left out, 2,190,963 mesh triangles, 48,844 objects with
a name, 31,679 with a category.

### What this says against the earlier measurements

| Path | Alpha (V2-STATUS.md) | This package | Change |
|---|---:|---:|---|
| BFAST end to end | 1981 ms | 353 to 455 ms | 4.4 to 5.6 times faster |
| BOS end to end | 3797 ms | 2082 to 2126 ms | 1.8 times faster |
| BFAST against BOS | 1.9 times | 5.4 to 5.9 times | the ratio the default rests on is larger, not smaller |

The BFAST default (user decision, 2026-09-07) holds on the columnar path and by a wider margin than
the measurement it was taken on. The reason is that the alpha's cost was mostly the two steps V2 does
not perform: building viewer-core groups (Track BIND measured 574 ms) and then one binding object per
instance (348 ms, 234.8 MB). Neither exists here; the whole build after parsing is 174 to 204 ms.

Transfer is still not measured, and the prepared file is 11.9 times the archive. That trade is
unchanged and remains a later optimization, as the decision record says.

## Findings

1. **A message closure allocated per row costs more than the work.** The first measurement put the
   instance-column build at 360 ms. `requireThat(condition, code, () => message)` allocates its
   closure whether or not the condition holds, and the loop ran three per instance plus one per
   transform float: about five million allocations per load. Writing the same checks as
   `if (...) fail(...)` took the step to 105 ms and the whole load from 724 ms to 455 ms. The
   assertion helper is still right everywhere that is not per row.
2. **Where the load time goes now.** Parsing 83 to 88 ms, metadata 87 to 102 ms, mesh list 73 to
   94 ms, instance columns 93 to 105 ms. There is no dominant step left. The largest reduction still
   available is the mesh list: 171,569 `Mesh` objects, each holding two typed-array views and a
   bounds object, for a model whose geometry is three buffers. `Geometry.meshes` being an array of
   records is what forces it. A columnar mesh table (slice offsets into shared buffers) would remove
   about 850,000 objects and that step; it is a model-contract change, recorded as a request below
   rather than made here.
3. **Names and categories are worth their 81 ms.** BOS stores `Entities.Name` as a string-table index
   and `Entities.Category` as another entity row whose name is the label. Decoding both gives 48,844
   named and 31,679 categorized objects on the reference model, against the alpha's generated
   "Entity 1234". The alpha never read them. `metadata: 'identity'` and `'none'` are there for a host
   that wants geometry sooner.
4. **The entity table is what makes geometry-free objects real.** 28,976 of 51,139 objects draw
   nothing. They exist because the combined BFAST embeds the BOS `Entities` table; a geometry-only
   BFAST has only the 22,163 entities its placements name. F01 depends on the combined file.
5. **Hidden placements have nowhere to go, and there are real ones.** `InstanceRecords` has no
   visibility column, so a placement the file marks hidden cannot be a row without being drawn. They
   are dropped and counted: the reference model has **14,864** of them, 3.2 percent of its 471,462
   placements, and the load says so through `formats/dropped-hidden-instances`. Their objects stay.
   Until the contract has a visibility column, a host cannot show a hidden placement or unhide one.
6. **`ObjectRecord.representation` is a single row, and objects have many placements.** It is set to
   the object's first drawn instance row, so `hasRepresentation` means something; the full mapping is
   `InstanceRecords.objectIndex`, which is the direction the render package needs anyway.
7. **The loaders package exports the parse but not the accessors.** `parseBfastModel` and the
   `RenderModel` type are exported; `instanceMeshIndex`, `instanceEntityIndex`, `instanceColor`,
   `instanceMatrix`, `meshCount`, `instanceCount`, `MESH_SLICE_INTS`, `INSTANCE_BYTES` and
   `writeBFast` are not. This package re-implements the record layout from the source. Two copies of
   a byte layout will drift. Track BIND asked for `writeBFast` for the same reason; adding the
   accessors would let both stop guessing.
8. **BOS preparation is 79 percent of the BOS load.** 1650 ms of 2082 ms. Anything that makes BOS
   faster has to make `bosToBfast` faster; nothing downstream of it matters much.
9. **Validation costs about a quarter of a load.** 128 ms against 455 ms, so it is off by default and
   `validate: true` is for input a host does not trust. Every test in this package runs it.

## Requests

To the supervisor, for the model contract (none block this track):

1. **A columnar mesh table.** `Geometry.meshes: readonly Mesh[]` forces 171,569 record objects for a
   model whose geometry is three buffers. A `MeshTable` of `baseVertex`, `vertexCount`, `firstIndex`,
   `indexCount` and per-mesh bounds columns over shared position and index buffers would express the
   same thing in five typed arrays. See finding 2 for the measurement.
2. **A visibility column on `InstanceRecords`.** One `Uint8Array` would let a hidden placement stay a
   row rather than be dropped (finding 5).
3. **Per-instance material columns**, or a documented decision that roughness and metallic are the
   render package's business. BFAST carries both per instance and there is nowhere to put them.
4. **`ObjectRecord.representation`**: either document it as "the first row" or drop it in favour of
   `InstanceRecords.objectIndex` (finding 6).

To the supervisor, for this package's manifest:

5. Nothing needed. `@bim-open-toolkit/model` and `@ara3d/viewer-loaders` are declared and are the only
   imports. No `three` import, type-only or otherwise, was added.

To the loaders session, through the supervisor:

6. Export the `renderModel.ts` accessors and constants, and `writeBFast` (finding 7). Re-verified
   against `viewer/packages/loaders/dist/index.d.ts` at this checkpoint: the exports are unchanged
   from the wave-1 brief, and `src/index.ts` matches `dist/index.d.ts`.

## Deviations from the brief, and why

1. **GLB does not go through the alpha `parseGlb` plus `convertObject`.** Three reasons, in the
   commit message of `36c441b`: that path produces viewer-core `InstancedGroup`s, so the columnar
   `Geometry` would have to be rebuilt from them; the grouping it performs is the step Track BIND
   measured as the dominant load cost and this package does not need it; and it discards node names
   and the node-to-instance mapping, so no object identity would survive, which F01 requires. The
   pure reader keeps every node as an object with its name and its parent. A document that needs
   Draco or meshopt is refused by name; the three path can be added behind the same interface if it
   is wanted.
2. **`src/diagnostics.ts` is a twelfth module**, beyond the eleven the brief lists. The brief also
   asks for "format diagnostics (codes, messages, paths)"; putting the codes and the error type in
   their own module is what let every adapter share them without importing each other.

## Verification

From `viewer/`, at `5325138`. The performance run was taken at `36c441b`; chunk 5 added `load.ts`
and documentation and changed nothing the performance suite exercises.

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/formats/tsconfig.json` | pass, no output |
| `npx eslint packages/formats` | pass, no output |
| `npm test -w @bim-open-toolkit/formats` | pass, 11 files, 149 tests, 1.2 s |
| `npm run perf -w @bim-open-toolkit/formats` | pass, 2 tests, twice, see the tables above |
| escape-hatch scan over `src` and `test` | 0 `any`, 0 `as` casts, 0 non-null assertions, 0 directives |

### Limits of this verification

- **The Parquet-backed metadata path is only exercised on a real model.** Writing a Parquet file to
  test against would mean writing a Parquet writer; `hyparquet` reads only. The index logic is
  covered in the unit run through `entityFactsFrom`, which takes decoded rows and a string table;
  what is not covered without the artifact is the decode itself and the failure of a corrupt table.
  Both run in `npm run perf` when the model is present.
- **The real `bosToBfast` conversion is only exercised in the performance run.** The unit run tests
  the composition with the conversion injected. The parity claim in the unit run is therefore
  "loading a BOS gives what loading its prepared bytes gives", proved on fixtures; on the reference
  model the performance run checks the object, instance and mesh counts match.
- **No browser.** Nothing in this package touches a DOM or a GPU, and `fetch`, `Blob`, `File`,
  `atob` and `TextDecoder` are used through their standard shapes. It has not been run in a browser.
- **One machine.** All timings are one Windows machine with other agents running. The performance
  assertions are relationships (a prepared file loads faster than one prepared on the way in; parsing
  costs less than decoding the property tables), never absolute times.
- **No large glTF, OBJ or STL was measured.** The three adapters are correctness-tested only.

## Incident: this track's commit `ebbfeaa` contains four of Track S2's files

**What happened.** Chunk 3's first commit used an explicit pathspec, correctly. Its message was then
mangled by the shell (backticks in the message were run as commands), so it was corrected with
`git commit --amend -F <file>` — **without a pathspec**. An amend with no pathspec re-commits the
whole index, and at that moment Track S2 had `viewer/packages/synthetic/src/{city,field,index}.ts`
and `test/city.test.ts` staged. They went into `ebbfeaa` under this track's message.

**State.** Nothing is lost or changed: the four files are committed with S2's content, and S2 has
committed further work on top (`2ac2b34`). `git log` for those files names `ebbfeaa`, which is
misleading about who wrote them.

**Not repaired here.** Rewriting `ebbfeaa` would rewrite history other sessions in this shared
checkout have already built on. The supervisor decides; this record is the repair for the history.

**Cause and rule.** The pathspec discipline was applied to `commit` but not to `amend`, and an amend
is a commit. Any `git commit --amend` in a shared checkout needs the same explicit pathspec, or the
message should be written to a file before the first commit so no amend is needed. The second is
better: it removes the operation rather than guarding it.

## Blockers

None.

## Tooling

| Check | Runs | Wall time | Real defects caught | Friction or false positives | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` | 14 | 10 to 25 s | 2. A structural read of `Blob.name` that cannot be typed without a cast, fixed by narrowing to `File` instead. And, once `fail` became a function declaration returning `never`, control-flow analysis found every place a guard was being repeated for the compiler's benefit. | `noUncheckedIndexedAccess` puts `?? 0` on every typed-array read, including loops whose whole point is speed; same finding as Track BIND. `exactOptionalPropertyTypes` makes an optional field a spread of an object or nothing, which reads badly. | helpful |
| `eslint` | 6 | 25 to 60 s | 1, and a real one: an unused `eslint-disable` directive, which is how I found that a regex literal in the STL header reader contained an actual NUL byte and matched nothing. The line was silently doing nothing. | Three to six times slower than `tsc` on the same files, and the only rule that fired in six runs was the one about its own directive. | helpful, but its cost is nearly all of it |
| escape-hatch scan (grep) | 2 | under 1 s | 0 | every prose "as" and "any" in a comment or a test name matches | neutral, and cheap enough to keep |
| `vitest` unit run | 22 | 1.0 to 1.2 s for 149 tests, after a 3 to 6 s import | 3. A float32 rounding assumption in a colour test. An ordering assumption about which invariant the validator reports first. A fixture that pointed a glTF at an empty data uri and would have passed for the wrong reason. | The import cost is five times the test time. The first run of the session took 14 s while other agents were compiling. | helpful; the fastest useful check here |
| `vitest` perf run | 3 | 37 to 210 s depending on machine load | 2, and the important ones: the closure allocation that was two thirds of the columnar build, and that a vitest run swallows `console.log` under `tail`, so the numbers a performance test exists to produce were nearly lost. The reports are now written to files. | Needs `--max-old-space-size` for a 111 MB model, and the same run varies 5x with other agents on the machine, which is why nothing absolute is asserted. | helpful, and the only check that changed the design |

One more, not a check: **the platonic-ts MCP server did not connect this session** (`ConnectionRefused`
at start). Everything here was found with `Read`, `Grep` and `Glob`. For a new package with no
existing symbols to navigate, that cost little; for a track editing an existing package it would.
