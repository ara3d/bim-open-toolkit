import { Camera, Group, InstancedMesh, Raycaster, Vector2, Vector3 } from 'three';
import { InstancedGroup, ViewerScene } from '@ara3d/viewer-core';

/**
 * The mirrored three.js objects of a viewer scene — structurally satisfied by
 * viewer-core's SceneObject. Meshes are re-read through getObject() after every
 * sync(), never cached, because capacity growth rebuilds the InstancedMesh.
 */
export interface SceneObjects {
  sync(): boolean;
  getObject(group: InstancedGroup): SceneGroupObject | undefined;
}

export interface SceneGroupObject {
  readonly root: Group;
  readonly mesh: InstancedMesh | null;
}

export interface PickHit {
  readonly group: InstancedGroup;
  readonly instanceIndex: number;
  readonly distance: number;
  readonly point: Vector3;
}

/** Converts client coordinates within a rect to normalized device coordinates. */
export const ndcFromClient = (
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { x: number; y: number } => ({
  x: ((clientX - rect.left) / rect.width) * 2 - 1,
  y: -((clientY - rect.top) / rect.height) * 2 + 1,
});

/**
 * Raycasts into a viewer scene's instanced meshes, returning the nearest
 * {group, instanceIndex} hit. Syncs the mirrored objects first so freshly
 * appended instances are pickable.
 */
export class Picker {
  private readonly raycaster = new Raycaster();

  constructor(
    private readonly scene: ViewerScene,
    private readonly objects: SceneObjects,
  ) {}

  pick(camera: Camera, ndcX: number, ndcY: number): PickHit | null {
    this.objects.sync();
    this.raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera);
    let best: PickHit | null = null;
    for (const group of this.scene.groups) {
      if (!group.visible) continue;
      const obj = this.objects.getObject(group);
      const mesh = obj?.mesh;
      if (!obj || !mesh) continue;
      obj.root.updateMatrixWorld(true);
      for (const hit of this.raycaster.intersectObject(mesh, false)) {
        if (hit.instanceId === undefined) continue;
        if (!best || hit.distance < best.distance)
          best = {
            group,
            instanceIndex: hit.instanceId,
            distance: hit.distance,
            point: hit.point,
          };
      }
    }
    return best;
  }
}
