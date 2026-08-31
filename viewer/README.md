# Ara 3D Viewer

A general-purpose WebGL viewer for the web, built on [three.js](https://threejs.org/).
Successor to `@ara3d/ara3d-webgl`. BIM-free: it knows nothing about IFC, BOS, or
any other file format.

This is an npm workspace with three packages, split so they can be developed
independently:

| Package | Role |
|---|---|
| [`@ara3d/viewer-core`](packages/core/) | Renderer: scene management, instanced drawing, materials, per-instance color, frame loop |
| `@ara3d/viewer-loaders` (planned) | Ingestion: BOS geometry and GLB loading with first-class progress reporting |
| `@ara3d/viewer-controls` (planned) | Interaction: camera navigation, picking/selection, section planes |

Design requirements carried over from the previous viewer's lessons:

- `three` is a **peer dependency** of every package — the host application picks
  the version, and only one copy of three ever loads.
- All numeric parameters are floats (plain `number`); no integer-quantized APIs.
- Per-instance color is a first-class API, changeable after creation.
- Scene structures support incremental population, so loaders can stream
  geometry in and report progress.

This workspace is a candidate to move to its own repository once stable.

## Developing

```
cd viewer
npm install
npm run -w @ara3d/viewer-core build
npm test -w @ara3d/viewer-core
```

Unit tests run under Node with vitest and never require a WebGL context: the
three.js object-graph logic is kept separate from the `WebGLRenderer` so it is
testable headless.
