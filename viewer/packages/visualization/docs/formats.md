# Geometry asset formats

`loadAssetModel(source, format, modelRef, options)` returns `Promise<Result<LoadedBosModel>>`, using the same geometry-independent records and instance bindings as BOS loading. `format` is `glb`, `gltf`, `obj` or `stl`. Source is a URL explicitly supplied by the host, an ArrayBuffer, or a Blob. Options accept AbortSignal, explicit Y/Z source-up, and an asynchronous resource resolver.

```ts
const result = await loadAssetModel(file, 'gltf', {
  id: 'imported-model', revision: contentHash,
}, {
  signal: controller.signal,
  resources: async (uri, signal) => hostResolveResource(uri, signal),
});
if (result.ok) {
  render.addModel(result.value.model.ref.id, result.value.bindings);
  showDiagnostics(result.diagnostics);
}
```

External glTF/GLB buffer and image URIs require `resources(uri, signal): Promise<ArrayBuffer | Blob>`. The resolver chooses permitted sources and receives cancellation. Resolved bytes become embedded data URLs before GLTFLoader runs; its loading manager blocks other network URLs. Input data URIs and GLB embedded buffers need no resolver. Selecting an asset does not authorize fetching arbitrary referenced network resources. The format demo resolves only files explicitly selected with the asset; absent files produce an actionable error.

The adapter reuses Three GLTFLoader, OBJLoader and STLLoader plus the existing `convertObject` core conversion. GLB version 2, JSON glTF, OBJ triangle geometry and ASCII/binary STL are supported. OBJ material libraries are not fetched; a diagnostic identifies neutral fallback materials. Loader errors and empty geometry return `asset-load-failed`. Cancellation returns `aborted` without a partial model. Parsing itself is not a worker; normalization yields between large batches.

Generated IDs (`visual:<group>:<instance>`) identify normalized visual instances within the supplied model revision. They are not BIM entity IDs, source document IDs or semantic classifications. Source placement and material tint live in representation bindings; logical transforms are identity and logical appearance white. Source-up conversion is explicit; output is Y-up with unknown units and registration. Alpha is applied once.

Textures can be loaded by GLTFLoader, but core rendering currently transfers only material color and basic material parameters. Texture, vertex-color, multi-material and skin/morph/clip limitations produce diagnostics instead of silent fidelity claims. Multi-material meshes use their first material. Specialized decoder extensions such as Draco/KTX2 are not configured and may reject an asset. Temporary parsed geometries, materials, textures and ImageBitmaps are disposed after conversion; CPU mesh arrays retained by the converted model remain usable.

`formatsDemo` exposes a format selector, asset/resource file picker, preview, cancel and restore. It keeps Snowdon until an asset loads successfully, saves the original bindings, swaps the visible model, and restores the original on cleanup/reset. It creates no second viewer and leaves G1 unchanged. Replacing or restoring a model rebuilds its GPU mirror; this is a deliberate load operation, not an appearance edit.

## Track checkpoint

- State: verified against V1/G1 and wave 4 fence.
- Owned files: `src/assets.ts`, `test/assets.test.ts`, `examples/features/formats.ts`, this document. No changes to BOS, core, shared exports or manifests.
- Focused direct Vitest `run test/assets.test.ts --maxWorkers=1 --cache=false`: 6/6 passed. Coverage includes embedded GLB placement, explicit glTF resources/missing resolver, OBJ fallback, ASCII/binary STL, malformed/empty input, resolver cancellation, alpha and disposal/diagnostic behavior.
- Strict `tsc --noEmit` passed for assets API plus formats demo with exact optional properties and unchecked indexes.
- No running processes, installs, package builds or generated files. Coordinator owns exports, gallery registration and browser verification, including actual image resource loading/file-picker behavior. Commit turn requested; hash reported after commit.
