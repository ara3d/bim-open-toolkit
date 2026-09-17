// `RaycastSource`: a world ray turned into group-and-slot hits by the three mirror.
//
// The render package's own `RaycastSource` reports a group ordinal; `SceneBinding.pick` wants the
// model as well, because ordinals are per model. `groupIndex()` is the mapping, and a group the
// mapping does not name belongs to nothing this binding owns, so its hit is dropped.

import type { InstancedGroup, SceneObject } from '@ara3d/viewer-core';
import type { GroupLocation, ModelRaycastHit, Ray } from '@bim-open-toolkit/render';
import { Raycaster, Vector3 } from 'three';

// Hits from the mirror, named by model. One `Raycaster` is kept, because building one per pick
// allocates for every click.
export const raycastSource = (
  objects: SceneObject,
  groups: () => ReadonlyMap<InstancedGroup, GroupLocation>,
): ((ray: Ray) => readonly ModelRaycastHit[]) => {
  const caster = new Raycaster();
  return (ray) => {
    caster.set(
      new Vector3(ray.origin[0], ray.origin[1], ray.origin[2]),
      new Vector3(ray.direction[0], ray.direction[1], ray.direction[2]),
    );
    const index = groups();
    const found: ModelRaycastHit[] = [];
    for (const hit of objects.raycast(caster)) {
      const at = index.get(hit.group);
      if (at === undefined) continue;
      found.push({
        modelId: at.modelId,
        group: at.group,
        slot: hit.instanceIndex,
        point: [hit.point.x, hit.point.y, hit.point.z],
        distance: hit.distance,
      });
    }
    return found;
  };
};
