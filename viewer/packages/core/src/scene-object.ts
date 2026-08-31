import { Scene } from 'three';
import { ViewerScene } from './scene.js';
import { InstancedGroup } from './instanced-group.js';
import { GroupObject } from './group-object.js';

/**
 * Mirrors a ViewerScene into a THREE.Scene: sync() diffs the model's groups
 * against the mirrored GroupObjects, creating/removing/updating as needed.
 * Pure object-graph code, unit-testable under Node.
 */
export class SceneObject {
  readonly model: ViewerScene;
  readonly scene = new Scene();

  private objects = new Map<InstancedGroup, GroupObject>();
  private disposed = false;

  constructor(model: ViewerScene) {
    this.model = model;
  }

  /** GroupObject mirroring a group, or undefined if not yet synced. */
  getObject(group: InstancedGroup): GroupObject | undefined {
    return this.objects.get(group);
  }

  get objectCount(): number { return this.objects.size; }

  /** Brings the THREE.Scene up to date with the model. Returns true if anything changed. */
  sync(): boolean {
    if (this.disposed) throw new Error('SceneObject is disposed');
    let changed = false;

    for (const [group, obj] of this.objects) {
      if (!this.model.groups.includes(group)) {
        this.scene.remove(obj.root);
        obj.dispose();
        this.objects.delete(group);
        changed = true;
      }
    }
    for (const group of this.model.groups) {
      let obj = this.objects.get(group);
      if (!obj) {
        obj = new GroupObject(group);
        this.objects.set(group, obj);
        this.scene.add(obj.root);
        changed = true;
      }
      if (obj.sync()) changed = true;
    }
    return changed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const obj of this.objects.values()) {
      this.scene.remove(obj.root);
      obj.dispose();
    }
    this.objects.clear();
  }
}
