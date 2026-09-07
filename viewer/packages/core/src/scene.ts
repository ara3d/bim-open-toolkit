import { InstancedGroup } from './instanced-group.js';

/**
 * The scene model: an ordered collection of InstancedGroups.
 * Pure bookkeeping — knows nothing about three.js or rendering.
 * Renderers diff against it each frame (see SceneObject.sync).
 */
export class ViewerScene {
  private readonly members = new Set<InstancedGroup>();
  private snapshot: readonly InstancedGroup[] | undefined;

  get groups(): readonly InstancedGroup[] { return this.snapshot ??= [...this.members]; }
  get groupCount(): number { return this.members.size; }

  /** Adds a group. Adding the same group twice is an error. */
  addGroup(group: InstancedGroup): void {
    if (this.members.has(group))
      throw new Error('group already in scene');
    this.members.add(group);
    this.snapshot = undefined;
  }

  /** Removes a group. Returns false if it was not in the scene. */
  removeGroup(group: InstancedGroup): boolean {
    const removed = this.members.delete(group);
    if (removed) this.snapshot = undefined;
    return removed;
  }

  clear(): void {
    this.members.clear();
    this.snapshot = undefined;
  }
}
