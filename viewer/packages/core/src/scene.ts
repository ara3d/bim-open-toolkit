import { InstancedGroup } from './instanced-group.js';

/**
 * The scene model: an ordered collection of InstancedGroups.
 * Pure bookkeeping — knows nothing about three.js or rendering.
 * Renderers diff against it each frame (see SceneObject.sync).
 */
export class ViewerScene {
  private _groups: InstancedGroup[] = [];

  get groups(): readonly InstancedGroup[] { return this._groups; }
  get groupCount(): number { return this._groups.length; }

  /** Adds a group. Adding the same group twice is an error. */
  addGroup(group: InstancedGroup): void {
    if (this._groups.includes(group))
      throw new Error('group already in scene');
    this._groups.push(group);
  }

  /** Removes a group. Returns false if it was not in the scene. */
  removeGroup(group: InstancedGroup): boolean {
    const i = this._groups.indexOf(group);
    if (i < 0) return false;
    this._groups.splice(i, 1);
    return true;
  }

  clear(): void {
    this._groups.length = 0;
  }
}
