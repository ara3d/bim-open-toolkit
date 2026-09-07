# Sectioning and layouts

`createSectionPlanes(section)` converts plain section data into Three planes. Plane equations retain points where `normal · point + constant >= 0`; all plane conditions apply together. Normals are normalized while preserving the equation. A `{kind: 'box', min, max}` section creates six planes retaining the box interior. Invalid/empty normals and nonfinite or reversed bounds are rejected.

`applyClipping(root, planes)` traverses actual Three materials, including shared materials, material arrays and BatchedMesh. It clones the planes and returns an idempotent restoration function. Call restoration before replacing a clipping scope; nested scopes should restore in reverse order. Synchronize the mirror before applying, enable viewer local clipping, and request a frame. This adapter affects materials present at application time; reapply after a mirror rebuild. It neither changes source geometry nor creates section caps.

```ts
viewer.objects.sync();
const restore = applyClipping(viewer.objects.scene, createSectionPlanes({
  kind: 'box', min: [-10, 0, -10], max: [10, 15, 10],
}));
viewer.setLocalClipping(true);
viewer.requestRender();
// Reset / cleanup:
restore();
viewer.setLocalClipping(false);
```

`explodeLayout(objects, {origin, strength, centerOf})` returns new records translated outward by their world-center displacement times the nonnegative strength. `gridLayout(objects, {origin, columns, spacing, centerOf})` places those centers on an XZ grid. Both are pure and preserve reference identity, appearance, rotation and scale. They validate finite positions/settings. `centerOf` is required because loaded logical objects may have identity transforms while their representations carry all source placement. Hosts can provide cached world centers from any representation system.

Always compute layouts from retained base records, rather than repeatedly transforming the previous output. Reset by submitting the same base. Explode strength zero also reproduces base values. These functions do not rebuild geometry or modify authoritative coordinates. Grid spacing is a host choice; large objects may overlap. Geometry-free objects remain records and need an explicit host center policy.

The independent `clippingDemo` offers axis selection/position, a central section box and clear; it enables local clipping and removes planes on cleanup. `layoutsDemo` aggregates each logical object's bounds across every representation once, offers explode/grid and restores source placement. The latter uses the model center for geometry-free records and labels the grid's potential overlap. Gallery registration and public export paths are coordinator-owned.

## Track checkpoint

- State: verified core APIs, implemented mini demos; V1/G1/G2 acknowledged.
- Ownership: `src/clipping.ts`, `src/layouts.ts`, their two tests, `examples/features/clipping.ts`, `examples/features/layouts.ts`, this document.
- Tests: `../../node_modules/.bin/vitest.cmd run test/clipping.test.ts test/layouts.test.ts --maxWorkers=1 --cache=false` — 2 files / 6 tests passed.
- Focused strict TypeScript `--noEmit` for `src/clipping.ts src/layouts.ts` passed, including exact optional properties and unchecked indexes.
- Tests cover six box faces, normalized equations, invalid values, multi/shared/batched material cleanup, explicit representation centers, preserved input/rotation/scale, zero-strength reset, grid centers and finite outputs.
- Outstanding: demo typecheck against stable integrated dependencies, gallery browser verification, coordinator exports/registration, serialized commit. Commit hash reported after commit.
- No builds, installs, generated output or running processes. Section caps, saved clipping schema and layout collision avoidance remain outside this bounded feature track.
