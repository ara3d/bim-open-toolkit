# BOS model loading and representation placement

`loadBosModel(source, modelRef, options)` returns `Promise<Result<LoadedBosModel>>`, where the value contains `model: ModelData` and `bindings: InstanceBinding[]`. Source accepts URL, ArrayBuffer, or Blob. Options accept `signal`, `onProgress`, and `sourceUp: 'Y' | 'Z'` (default Y). A host explicitly adds the successful bindings to its render adapter; loading never populates a scene itself.

```ts
const controller = new AbortController();
const result = await loadBosModel('/local-model.bos', {
  id: 'snowdon', revision: fileHash,
}, { signal: controller.signal, sourceUp: 'Z', onProgress: showProgress });
if (result.ok) {
  registry.add(result.value.model);
  render.addModel(result.value.model.ref.id, result.value.bindings);
  render.applySnapshot(result.value.model.objects);
}
```

Runtime object IDs identify BOS entity rows (`bos:<row>`), scoped by the supplied loaded-model ID. Positive source LocalId values remain `sourceId` metadata; identical or absent source IDs do not collapse separate entities. Entity rows without geometry remain selectable data records. BOS parameters beyond LocalId are not loaded, and units/registration remain explicitly unknown.

Every logical object's initial transform is identity and color is white. Each representation binding carries `localTransform` and RGBA `colorFactor`. The render adapter multiplies `object.transform * localTransform`, and multiplies logical color/opacity by source factors. Explicit Z-up conversion rotates source placement -90 degrees about X to produce a Y-up scene. Source alpha lives only in the factor; normalized group material opacity is 1, avoiding double alpha multiplication. Logical colors therefore act as tints. Multiple representations keep their individual offsets when a logical object moves, hides or changes opacity. Optional binding fields leave existing adapters backward compatible.

URL fetch uses AbortSignal and byte progress. Parse and conversion progress are discrete steps. Cancellation before completion returns an `aborted` diagnostic without a value; failures return `load-failed`. Parsing and synchronous conversion are not interruptible workers; cancellation prevents publishing their late result. Hosts should also discard results from superseded requests. The existing BOS converter skips source-hidden instances; their entity data survives, but their hidden geometry cannot currently be restored by a visibility edit.

## Snowdon measurement

Run `node scripts/snowdon-benchmark.mjs [absolute-fixture-path]` from this package after the existing loader/core packages are built. It reads the fixture only, prints JSON, and never copies the private model into the repository. Bounds are source coordinates; timings are CPU-only and do not measure display latency.

September 7, 2026; Windows 10.0.26200, Intel Core Ultra 7 155H, Node 22.13.1; one sample, no warmup:

- SHA-256: `fc31c4463d9eb958ae8de3d853cfc8224b9469477b419857fbc929956c9cc51d`; 9,362,255 bytes.
- 51,139 entity rows/objects, 471,462 source instances, 456,598 rendered instances, 158,055 groups, 6,185,680 instanced triangles.
- Source bounds min `[-244.280197, -274.774181, -58.666599]`, max `[240.934296, 195.444504, 85.069901]`.
- Read 5.17 ms, parse 1,283.67 ms, convert 1,451.18 ms, bounds 166.60 ms.
- Finding: 158,055 groups are a substantial browser draw-call/resource burden. A bounded preview should be labeled explicitly; this CPU benchmark does not establish full-model interactive performance. Geometry batching remains further work.

## Track checkpoint

- State: verified against V1/G1 wave 2; prior source edits clean when ownership transferred.
- Files: `src/loading.ts`, `src/render.ts`, `test/loading.test.ts`, `test/render.test.ts`, this document, `scripts/snowdon-benchmark.mjs`.
- Gate: `../../node_modules/.bin/vitest.cmd run test/loading.test.ts test/render.test.ts --maxWorkers=1 --cache=false` — 2 files / 12 tests passed.
- Gate: focused `tsc --noEmit --strict --target ES2022 --module ES2022 --moduleResolution bundler --lib ES2022,DOM --skipLibCheck --exactOptionalPropertyTypes --noUncheckedIndexedAccess src/loading.ts src/render.ts` passed.
- Snowdon script passed with results above. No build, installs, generated files, running processes, or fixture writes.
- Outstanding: coordinator package loading subpath/dependency, gallery integration, browser gates, serialized commit. Commit hash reported to coordinator after commit.
