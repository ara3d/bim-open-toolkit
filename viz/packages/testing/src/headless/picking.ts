// The three.js mirror of a headless scene, and picking against it, in Node.
//
// `SceneObject` builds buffer geometries, materials and instanced meshes. None of that needs a GL
// context: three only touches the GPU when a renderer draws. So a test can ask what a ray hits,
// which is the input picking takes, and get back instance rows and object indices rather than
// renderer internals.

import { InstancedGroup, SceneObject } from '@ara3d/viewer-core';
import type { Geometry, Vec3 } from '@bim-open-toolkit/model';
import { Raycaster, Vector3 } from 'three';
import { objectOfRow, rowOfInstance, type HeadlessScene } from './scene.js';

// One thing a ray hit, in the terms the model uses.
export type HeadlessHit = {
  readonly row: number;
  readonly objectIndex: number;
  readonly distance: number;
  readonly point: Vec3;
};

// A mirrored scene that can be asked what a ray hits. Dispose it when the test is done: it holds
// three.js geometries and materials.
export type HeadlessMirror = {
  readonly object: SceneObject;
  // Brings the mirror up to date with the scene. True when anything changed.
  readonly sync: () => boolean;
  // How many mirrored objects the scene produced.
  readonly objectCount: () => number;
  // What a ray hits, nearest first. Invisible, fully transparent and clipped instances are left
  // out, which is `SceneObject`'s own rule.
  readonly hits: (origin: Vec3, direction: Vec3) => readonly HeadlessHit[];
  readonly dispose: () => void;
};

// Mirrors a headless scene into three.js and answers ray queries against it.
export function headlessMirror(built: HeadlessScene, geometry: Geometry): HeadlessMirror {
  const object = new SceneObject(built.scene);
  const ordinalOf = new Map<InstancedGroup, number>(built.groups.map((group, ordinal) => [group, ordinal]));
  object.sync();
  return {
    object,
    sync: () => object.sync(),
    objectCount: () => object.objectCount,
    hits: (origin, direction) => {
      const caster = new Raycaster(new Vector3(...origin), new Vector3(...direction).normalize());
      return object.raycast(caster).map((hit) => {
        const row = rowOfInstance(built, ordinalOf.get(hit.group) ?? -1, hit.instanceIndex);
        return {
          row,
          objectIndex: objectOfRow(geometry, row),
          distance: hit.distance,
          point: [hit.point.x, hit.point.y, hit.point.z],
        };
      });
    },
    dispose: () => { object.dispose(); },
  };
}

// A ray from a point towards another point, which is the shape a picking test states its intent in.
export const rayThrough = (from: Vec3, to: Vec3): { readonly origin: Vec3; readonly direction: Vec3 } => ({
  origin: from,
  direction: [to[0] - from[0], to[1] - from[1], to[2] - from[2]],
});
