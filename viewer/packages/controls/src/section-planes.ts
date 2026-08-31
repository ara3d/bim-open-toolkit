import { Material, Plane, Vector3 } from 'three';
import { ViewerScene } from '@ara3d/viewer-core';
import { SceneObjects } from './pick.js';

export type Axis = 'x' | 'y' | 'z';

const axisNormal = (axis: Axis): Vector3 =>
  axis === 'x' ? new Vector3(1, 0, 0) : axis === 'y' ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1);

/**
 * Section-plane state for a viewer scene, applied via three's clippingPlanes
 * on the materials of the scene's groups. Call apply() after changing planes
 * or after groups are added.
 *
 * Note: the WebGLRenderer must have localClippingEnabled = true for material
 * clipping planes to take effect.
 */
export class SectionPlanes {
  private readonly _planes: Plane[] = [];
  private _enabled = true;

  get planes(): readonly Plane[] { return this._planes; }
  get enabled(): boolean { return this._enabled; }
  set enabled(v: boolean) { this._enabled = v; }

  /**
   * Adds an axis-aligned plane keeping the half-space where `axis <= offset`
   * (or `>= offset` when flipped). Returns the plane for later removal.
   */
  addAxisPlane(axis: Axis, offset: number, flip: boolean = false): Plane {
    const normal = axisNormal(axis);
    if (!flip) normal.negate();
    return this.addPlane(new Plane(normal, flip ? -offset : offset));
  }

  /** Adds an arbitrary plane (three convention: kept where n·p + constant >= 0). */
  addPlane(plane: Plane): Plane {
    this._planes.push(plane);
    return plane;
  }

  remove(plane: Plane): boolean {
    const i = this._planes.indexOf(plane);
    if (i < 0) return false;
    this._planes.splice(i, 1);
    return true;
  }

  clear(): void {
    this._planes.length = 0;
  }

  /**
   * Writes the current plane set (or null when disabled/empty) onto the
   * materials of every group in the scene. Syncs the mirrored objects first so
   * new groups are covered.
   */
  apply(scene: ViewerScene, objects: SceneObjects): void {
    objects.sync();
    const active = this._enabled && this._planes.length > 0 ? this._planes : null;
    for (const group of scene.groups) {
      const mesh = objects.getObject(group)?.mesh;
      if (!mesh) continue;
      const materials: Material[] = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const m of materials) {
        m.clippingPlanes = active;
        m.needsUpdate = true;
      }
    }
  }
}
