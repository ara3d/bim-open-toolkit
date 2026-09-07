# BFAST loading verification — 2026-09-07

F02 follow-up requested by the user: support prepared uncompressed BOS geometry
using the existing ara3d-webgl readers. This adds an ingestion path; it does not
complete worker parsing, streaming properties or the F02 release qualification.

## Implementation and supported data

`loadBos` and `loadBosModel` detect BFAST by signature. `loadBfast`,
`parseBfastModel` and `bfastToGroups` expose the lower-level operations. Container
and render-record readers are adapted from ara3d-webgl under its retained MIT
notice. Mesh arrays borrow the input file; no ZIP or Parquet decode is performed.

Triangle meshes, RGBA, material roughness/metalness, 3x4 transforms, entity rows,
hidden flags and the -1 mesh sentinel are supported. Invalid ranges, missing
buffers, partial records, invalid indices and nonfinite geometry fail. Lines,
quads and vertex colors are explicitly unsupported. BFAST lacks LocalId and
property tables; only entities referenced by instance records can be retained.
Hidden and geometry-free instance entities remain available as normalized objects.

## Exact-source parity

Read the original Snowdon BOS and converted it using the already built
`ara3d-webgl/out/bosToBfast.cjs`. The generated private model remains under ignored
`artifacts/bfast/`; no fixture bytes are committed.

| Format | Bytes | SHA-256 |
|---|---:|---|
| BOS | 9,362,255 | `fc31c4463d9eb958ae8de3d853cfc8224b9469477b419857fbc929956c9cc51d` |
| Direct BFAST conversion | 101,607,040 | `0a2c7775d3d3862699c4bfe403c410988d5d741925e43c98f68b331767dda855` |

`node scripts/check-bfast.mjs <source.bos> <converted.bfast>` passed: all
158,055 groups match in positions, triangle indices, transforms, colors,
materials and entity row mappings (numeric tolerance 1e-5). Both paths produce
456,598 rendered instances and 6,185,680 triangles. The BFAST normalized model
has 25,675 referenced objects, including 3,512 without rendered geometry; the
BOS has 51,139 entity-table rows. This is an explicit format data limitation.

The separate supplied `ara3d-webgl/docs/snowdon.bfast` was also parsed and
converted successfully: 56,874,496 bytes, SHA-256
`6af11705f1c9968c78e103b41d9028b2624a13b2c38c8260c055e144ab619a0a`,
13,843 groups, 29,666 rendered instances, 6,185,680 triangles. Its different
preparation prevents treating it as an exact instance-for-instance baseline.

## CPU measurements

Windows, Node 22.13.1; three alternating fresh processes per format, no warmup,
same exact-source files above. File reading excluded. Reproduce with the parity
script's `--measure-bos` and `--measure-bfast` options in separate processes.
Do not use the combined parity process for benchmarking: retaining both large
models changes allocation/GC costs.

| Format | Parse ms (three runs) | Group conversion ms (three runs) | Median combined ms |
|---|---|---|---:|
| BOS | 1369.2, 1282.8, 1253.8 | 1798.5, 1444.4, 1379.4 | 2727.2 |
| BFAST | 118.8, 99.5, 93.8 | 681.9, 647.9, 682.3 | 776.1 |

About 3.5× faster median parsing plus group creation in this small CPU sample.
These measurements exclude transfer, normalized bindings, GPU upload and first
useful frame; they are not an end-to-end loading guarantee. The larger payload
and retained input memory matter. HTTP compression may reduce transfer size
without changing the decoded BFAST format, but was not measured here.

## Local and combined checks

- Loader/visualization package TypeScript builds passed.
- Loader tests plus normalized BOS/BFAST loading tests: 7 files, 40 tests passed.
- Strict example checking and production gallery build passed; the existing
  bundle-size warning remains.
- Exact-source parity script passed over all converted geometry and instances.
- Edge 152.0.4191.66, 1280×800, isolated SwiftShader WebGL2: direct-conversion
  Snowdon BFAST rendered; category tint, ghosting, reset and fit passed with no
  browser errors. Screenshot visually inspected. Scenario elapsed 37,967 ms
  includes loading and interactions; software rendering is not a hardware
  performance profile.

Browser reproduction: set `SNOWDON_BFAST_PATH` for the demo server, open
`?feature=appearance&model=bfast`, or run the browser smoke script with
`BIM_BROWSER_CASE=BFAST`. Gallery defaults to the sibling repository fixture.

Owned checkpoint: loader BFAST reader/converter/tests, shared loading dispatch,
gallery fixture choice and endpoints, focused browser scenario, parity script,
and this evidence. Implementation and local combined checks are complete; no
claim of streaming, full BOS metadata parity or hardware release qualification.
