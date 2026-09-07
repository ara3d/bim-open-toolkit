# @ara3d/viewer-loaders

File-format ingestion for the Ara 3D viewer. Loads GLB and BOS (BIM Open
Schema) models into `@ara3d/viewer-core` scene structures. All format
knowledge lives here — viewer-core knows nothing about files.

## What it does

- **GLB** (`loadGlb`): parses with three's `GLTFLoader`, bakes node transforms
  into per-instance world matrices, and merges meshes that share geometry and
  material parameters into `InstancedGroup`s (per-instance color carries the
  material color, so materials differing only by color still merge). Source
  `InstancedMesh`es are flattened too.
- **BOS** (`loadBos`): decodes the `.bos` container — a ZIP of parquet tables —
  using `jszip` + `hyparquet`, then converts the geometry tables
  (fixed-point vertices, shared vertex/index buffers, TRS transforms,
  RGBA + roughness/metalness materials) into groups. Geometry only; entity and
  parameter tables are out of scope for the viewer.
- **Progress**: both loaders take `{ onProgress }` receiving
  `{ stage: 'fetch' | 'parse' | 'convert', loaded, total? }`, and add each
  group to the scene as it is produced rather than in one batch.

- **BFAST** (`loadBfast`, also auto-detected by `loadBos`): reads Ara 3D's
  uncompressed render model without ZIP/Parquet decoding. `parseBfastModel`
  and `bfastToGroups` expose parsing and conversion separately. Mesh vertices
  and indices remain views on the source bytes. Triangle models with instance
  RGBA, roughness/metalness, transforms, flags and entity row indices are
  supported. Lines, quads and vertex colors return explicit errors.
  BFAST is prepared geometry, not a lossless archive of BOS property tables:
  LocalId and entities without instance records are unavailable. Do not mutate
  source bytes while groups borrow them. Fetching is whole-file, not streaming.

## Usage

```ts
import { Viewer } from '@ara3d/viewer-core';
import { loadGlb, loadBos } from '@ara3d/viewer-loaders';

const viewer = new Viewer();
await loadGlb('model.glb', viewer.scene, {
  onProgress: (p) => console.log(p.stage, p.loaded, p.total),
});
await loadBos('model.bos', viewer.scene);
await loadBos('model.bfast', viewer.scene); // detected by header, not extension
```

Sources can be a URL, `ArrayBuffer`, or `Blob`. The lower-level pieces
(`convertObject`, `toMeshBuffers`, `bosToGroups`, `parseBosGeometry`,
`composeTrs`) are exported for reuse and testing.

`loadBos` returns `groupEntities` mapping each group's instance indices back
to BOS entity indices, for wiring picking to model data.

## Provenance

The BOS reader is ported from the `@ara3d/ara3d-webgl` npm package v1.3.15
(`src/loader/bimOpenSchemaLoader.ts`, `bimGeometry.ts`, `buildInstances.ts`,
recovered from the package's published source map). Source repo:
https://github.com/ara3d/ara3d-webgl

The BFAST container and render-record readers are adapted from that repository's
`src/loader/bfast.ts` and `renderModel.ts`, with its MIT notice retained in source
and emitted JavaScript. Test fixture serialization uses its `tests/writeBFast.mts`.

## Tests

`npm test` — vitest, node environment, no network and no GL. Conversion logic
runs against hand-built glTF/BOS structures; a container integration test runs
against `platoflow/data/duplex.bos` when that local test file exists and skips
otherwise.
