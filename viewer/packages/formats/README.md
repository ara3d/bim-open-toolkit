# @bim-open-toolkit/formats

Every supported model file becomes one `LoadedModel`, through one entry point that reports its
failures instead of raising them.

```ts
import { loadModel } from '@bim-open-toolkit/formats';

const result = await loadModel('https://example.org/tower.bfast', {
  onProgress: ({ phase, loaded, total }) => report(phase, loaded, total),
  signal: controller.signal,
});

if (!result.ok) return show(result.diagnostics);
const { data, geometry, coordinates } = result.value;
```

`result.value` is a `LoadedModel`:

- **`data`** is `ModelData` from `@bim-open-toolkit/model`: the model's identity and one
  `ObjectRecord` per object, with its name, category, source id and parent where the format carries
  them. An object with no geometry is a normal object, which is what a model with property-only rows
  needs.
- **`geometry`** is the model contract's `Geometry`: a list of `Mesh` and one columnar
  `InstanceRecords`. Instances are four typed arrays for the whole model, not one object per
  placement, and `objectIndex` maps every placement back to its object.
- **`coordinates`** is the frame the model reports in, and the same object as `data.coordinates`.
- **`diagnostics`** is what the loader observed: what it could not carry over, and what it assumed.

## What it reads

BFAST is the default and the first-class path; BOS is prepared as BFAST and takes the same path.
GLB, glTF, OBJ and STL are read by small parsers in this package. [docs/formats.md](docs/formats.md)
is the format table: what each one carries, what is lost, and what is assumed.

## Sources and resources

A source is a URL, a `URL`, an `ArrayBuffer`, a typed-array view, a `Blob` or a `File`. A URL is
fetched with byte progress and cancellation, and a server that answers a model request with HTML is
rejected by name rather than parsed.

A document that names a file it does not contain, such as a `.gltf` and its `.bin`, goes to a
`Resolver` the host supplies. Without one the load fails naming the uri. Nothing is fetched because
a document asked for it.

```ts
import { loadModel, mapResolver } from '@bim-open-toolkit/formats';

await loadModel(gltfBytes, { resolver: mapResolver([['scene.bin', binBytes]]) });
```

## Progress and cancellation

`onProgress` reports `fetch`, `parse`, `metadata` and `convert` phases, with a `total` only when the
loader knows one. `signal` stops the load: a cancelled load publishes no further progress and comes
back as a `formats/cancelled` diagnostic, not as an exception.

## Checking a model

`validateLoadedModel` walks every index and every float and reports what does not hold: an instance
naming a mesh or an object that is not there, a non-finite transform, a colour factor outside zero to
one, a mesh index past its vertices, two objects sharing a key. It is not run on every load, because
it costs about as much as building the model; pass `validate: true`, or call it yourself, for input
you do not trust.

## Commands

```
npx tsc --noEmit -p packages/formats/tsconfig.json   # from viewer/
npx eslint packages/formats
npm test -w @bim-open-toolkit/formats
npm run perf -w @bim-open-toolkit/formats            # needs a real model; skips with a reason
```

The performance suite measures BFAST against BOS on the columnar path and writes its numbers to
`docs/measurements-bfast.md` and `docs/measurements-bfast-versus-bos.md`. It never commits model
bytes; set `SNOWDON_BFAST_PATH` and `SNOWDON_BOS_PATH` to point it at your own files.
