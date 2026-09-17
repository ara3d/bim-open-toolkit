# @ara3d/viewer-controls

Interaction for the Ara 3D viewer: camera navigation, picking/selection, and
section planes. Owns no scene content — it reads the `@ara3d/viewer-core`
scene and mutates only the camera, the selection, and material clipping state.

## Pieces

- **OrbitModel** — pure orbit camera state (target + distance + azimuth/polar
  angles): input deltas in, camera pose out. Float params: rotate/pan/zoom
  speed, min/max distance, polar clamps.
- **OrbitControls** — thin DOM binding over OrbitModel: left-drag rotates,
  right-drag or shift+left pans, wheel dollies. Applies the pose to the
  viewer's camera and calls `requestRender()` after every change (works with a
  stopped frame loop).
- **Picker** — raycasts into the scene's instanced meshes, returning the
  nearest `{ group, instanceIndex }`. Syncs and re-reads meshes each pick
  (never caches an InstancedMesh — capacity growth rebuilds it).
- **Selection** + **Emitter** — current selection with a typed `changed`
  event; **PickControls** wires click-to-select (drag-aware) onto an element.
- **SectionPlanes** — axis-aligned and arbitrary clipping planes applied via
  three's `clippingPlanes` on the materials of the scene's groups, with
  enable/disable. Note: the renderer needs `localClippingEnabled = true`.

## Usage

```ts
import { Viewer, SceneObject } from '@ara3d/viewer-core';
import { OrbitControls, Picker, Selection, PickControls } from '@ara3d/viewer-controls';

const viewer = new Viewer();
viewer.attach(canvas);

const orbit = new OrbitControls(viewer);
orbit.attach(canvas);

// Picking needs the viewer's mirrored scene objects (SceneObject). Until
// viewer-core exposes its internal one, construct against your own SceneObject
// or pass the viewer's once an accessor exists.
const objects = new SceneObject(viewer.scene);
const picker = new Picker(viewer.scene, objects);
const selection = new Selection();
selection.changed.on((sel) => console.log('selected', sel));
new PickControls(picker, selection, () => viewer.camera).attach(canvas);
```

`Picker` and `SectionPlanes` accept anything satisfying the small
`SceneObjects` interface (`sync()` + `getObject()`), which viewer-core's
`SceneObject` matches structurally.

## Tests

`npm test` — vitest, node environment, no GL: orbit math and clamping, DOM
binding via a fake element, real raycasts against core `SceneObject` meshes
(including the rebuild-after-capacity-growth case), selection event plumbing,
and section-plane state.
