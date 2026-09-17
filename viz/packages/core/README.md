# @ara3d/viewer-core

The renderer core of the Ara 3D viewer: scene management, instanced drawing,
materials, per-instance color, and the frame loop. No file formats and no input
handling — it draws what it is handed. Loading lives in `@ara3d/viewer-loaders`,
interaction in `@ara3d/viewer-controls`.

`three` is a peer dependency: the host application chooses the version.
All numeric parameters are plain floats. BIM-free; part of a workspace that is
a candidate to move to its own repository once stable.

## Usage

```ts
import { Viewer, InstancedGroup } from '@ara3d/viewer-core';

const viewer = new Viewer();
viewer.attach(canvas);

// A mesh drawn many times, with a 4x4 transform and an RGBA color per instance.
const group = new InstancedGroup(
  { positions, normals, indices },        // MeshBuffers (typed arrays)
  { metalness: 0.1, roughness: 0.8, opacity: 1.0 },
);
group.append(transforms, colors);         // 16 floats + 4 floats per instance
viewer.scene.addGroup(group);
viewer.start();

// Later — loaders stream more instances in, colors change after creation:
group.append(moreTransforms, moreColors);
group.setColor(0, 1.0, 0.5, 0.0, 1.0);
group.visible = false;
```

## Architecture

Two layers, split so everything up to the draw call is unit-testable under
Node without a WebGL context:

- **Scene model** (`ViewerScene`, `InstancedGroup`, `MeshBuffers`,
  `MaterialConfig`): pure bookkeeping. Mutations bump version counters.
  Supports incremental append for progressive loading.
- **three.js mirror** (`SceneObject`, `GroupObject`): diffs the model each
  frame and lazily syncs `THREE.InstancedMesh` objects (instance matrices,
  instance colors, visibility) using the version counters. The `Viewer` owns
  the camera, frame loop, and — once attached to a canvas — the
  `WebGLRenderer`.

Known limitation: per-instance color renders as RGB (three's `instanceColor`);
the alpha channel is stored in the model but not yet applied per instance
(group-level opacity works via the material).

## Scripts

- `npm run build` — compile with tsc to `dist/`
- `npm test` — vitest, Node environment, no GL required
