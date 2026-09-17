# @bim-open-toolkit/render

Binds a model's geometry to a viewer-core scene and applies bulk changes to it.

The package holds the instance table, bulk column updates, a representation registry with
replacement, picking, clipping, environment, overlay primitives, capture and frame timing. Its
design rule is that anything not needing a WebGL context is pure or data-structure level and tested
in Node, and anything that does need one is a small interface a test can substitute. `three` is a
peer dependency; nothing in `src` imports it.

`docs/render.md` explains how the parts fit together, what is measured and what needs a browser.

## The shape of it

```ts
import { ViewerScene } from '@ara3d/viewer-core';
import { SceneBinding, applyUpdates, dirtySets, publishDirty } from '@bim-open-toolkit/render';

const scene = new ViewerScene();
const binding = new SceneBinding(scene, () => viewer.requestRender());

// keys[i] is the object key of object ordinal i, matching geometry.instances.objectIndex.
const bound = binding.addModel('snowdon', geometry, keys);
if (!bound.ok) report(bound.diagnostics);

// A change table names objects and the columns that changed.
binding.applyChanges('snowdon', changes);

// Or write a resolved appearance straight from the model package.
binding.applyStyles('snowdon', resolveStyles(composition, keys));
```

A `Geometry` is `@bim-open-toolkit/model`'s mesh library plus columnar instance records. Binding it
produces one row per rendered instance and one `InstancedGroup` per mesh, with the rows of a group
contiguous. No per-instance JavaScript object is created at any point: object keys reach rows
through typed-array index columns.

Under the composition are the pieces on their own, which is what a feature module uses:

```ts
import { buildInstanceTable, writeColors, writeVisibility, everyRow } from '@bim-open-toolkit/render';

const table = buildInstanceTable(geometry, keys);          // Result<InstanceTable>
const dirty = dirtySets(table.value);
writeColors(table.value, rows, Float32Array.of(1, 0, 0), dirty);   // one colour, listed rows
writeVisibility(table.value, everyRow, Uint8Array.of(1), dirty);   // show everything
publishDirty(table.value, dirty);                                   // one publish per touched group
```

## What it does not do

- It does not draw. Six one-method-or-so interfaces (`RaycastSource`, `ClippingTarget`,
  `EnvironmentTarget`, `OverlayRenderer`, `CaptureTarget`, `GpuFrameTimer`) are where a renderer
  goes.
- It does not own a camera, controls, a command bus, feature state or persistence. Those are the
  `interact`, `viewer` and `features` packages.
- It does not decide what colour an object should be. `resolveStyles` in the model package does;
  this package writes the answer into buffers.
- It does not build acceleration structures for picking. The renderer already has one; the pure
  ray-and-mesh code here is for sources that draw their own geometry.

## Checks

From `viewer/`:

```
npx tsc --noEmit -p packages/render/tsconfig.json
npx eslint packages/render
npm test -w @bim-open-toolkit/render
npm run perf -w @bim-open-toolkit/render -- --reporter=verbose
```

The performance suite is never part of `npm test`. It needs the verbose reporter, because the
default one hides the tables it exists to print.

## Constraints worth knowing before using it

- **Do not append instances to a group after its table is built.** The table captures each group's
  live buffer views once, because reading them per row would allocate per instance. Appending can
  reallocate the buffer underneath.
- **Hiding keeps opacity.** The stored alpha is always `visible ? opacity : 0`, so hiding a ghosted
  object and showing it again returns it to ghosted.
- **A bulk write does not publish itself.** Call `publishDirty`, or use `SceneBinding`, which
  publishes after each operation. Writing straight into the borrowed buffers is what makes a bulk
  update cheap; publishing once per touched group at the end is what keeps it correct.

## Zero escape hatches

No `any`, no `as` cast (other than `as const`), no non-null assertion, no compiler or lint directive
in `src` or `test`.
