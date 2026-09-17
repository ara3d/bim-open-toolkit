# Track M3 checkpoint — model follow-up for Track F

State: verified. Contract M1, additive only: nothing renamed, removed or re-signed and every new field
optional, so the label stays M1 and the additions are the "M1.2 additions" section of
[CONTRACTS-M1.md](CONTRACTS-M1.md). Fence: `viewer/packages/model/**` less its four config files;
baseline 224 tests, escape hatches added none.

## Chunks and commits

| # | Concern | Files | Commit |
|---|---|---|---|
| 1 | Visibility column | `src/{mesh,instance-table}.ts`, both tests | `45014e7` |
| 2 | `MeshTable` | `src/mesh.ts`, `test/mesh.test.ts` | `ea3ddf2` |
| 3 | Roughness and metallic columns | `src/{mesh,instance-table}.ts`, both tests | `bc75733` |
| 4 | What `representation` names | `src/objects.ts`, `test/objects.test.ts` | `b57c237` |
| 5 | CONTRACTS M1.2, README, this file | `docs/**`, `README.md`, `test/readme.test.ts` | this commit |

## Delivered

- `InstanceRecords.visible?: Uint8Array` (1 drawn, 0 hidden, absent all visible), `isInstanceVisible`,
  `InstanceRecord.visible`, a `visible` bool column over the records' bytes: hiding is a column write.
- `MeshTable`, `meshTableFrom`, `meshAt` (views, nothing copied), `meshCount`, `meshBoundsAt`,
  `boundsStride`, `Geometry.meshTable?`; mesh-local indices are what make `meshAt` copy-free.
- `InstanceRecords.roughness?`/`metallic?`, `instanceRoughness`, `instanceMetallic`, `defaultRoughness`
  (1), `defaultMetallic` (0), two `InstanceRecord` fields, two f32 columns; absent reads as the default.
- `ObjectRecord.representation` documented, not deprecated, with a test pinning its meaning.

## The material decision

Roughness and metallic are model-level, as optional per-instance columns, because a source file
carries them per placement: the BFAST instance flags word holds a roughness byte and a metallic byte,
and with nowhere to put them the loader drops them. What a renderer decides for itself stays in
`render`, and a further parameter belongs here only when a format carries it per placement.

## Commands and results

| Command | Result |
|---|---|
| `npx tsc --noEmit -p packages/model/tsconfig.json` | pass, no output, 6 s |
| `npx eslint packages/model` | pass, no output, 10 s |
| `npm test -w @bim-open-toolkit/model` | pass, 20 files, 239 tests, 1.0 to 1.3 s |
| `npx tsc --noEmit -p packages/formats/tsconfig.json` | pass, read-only, 6 s |
| `npx tsc --noEmit -p packages/synthetic/tsconfig.json` | pass, read-only, 5 s |

## Findings

- `meshTableFrom` copies the buffers and so saves Track F nothing by itself: a BFAST holds one vertex
  buffer and one index buffer with per-mesh local indices, so a loader can fill the record from the
  file with four `Int32Array`s and a bounds pass, and build no `Mesh` object at all.
- `render` exports `Representation` for a replacement mesh, a different thing from `ObjectRecord.representation`; renaming would be a later revision, so documenting leaves that collision in place.

## Tooling

| Check | Runs | Wall time | Defects caught | Friction | Verdict |
|---|---|---|---|---|---|
| `tsc --noEmit` | 6 | 6 s | 0 | `noUncheckedIndexedAccess` puts `?? 0` on every typed-array read in the gather loops; `exactOptionalPropertyTypes` makes each optional column a conditional spread | neutral: small additions, typed by their tests |
| `eslint` | 5 | 10 s | 0 | slowest gate here, as in M2 | hindrance at this package size |
| `vitest` | 8 | 1.0 to 1.3 s, 239 tests | 0 | none | helpful as the fastest gate, though everything passed first time |
| downstream `tsc` (formats, synthetic) | 4 | 5 to 6 s each | 0 | none | helpful: the cheapest proof an optional field stayed additive |
