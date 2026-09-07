import { InstancedGroup } from './instanced-group.js';

/**
 * The scene model: an ordered collection of InstancedGroups.
 * Pure bookkeeping — knows nothing about three.js or rendering.
 * Renderers diff against it each frame (see SceneObject.sync).
 */
export class ViewerScene {
  private readonly members = new Map<InstancedGroup, () => void>();
  private snapshot: readonly InstancedGroup[] | undefined;
  private revision = 0;
  private readonly changed = () => { this.revision++; };

  get groups(): readonly InstancedGroup[] { return this.snapshot ??= [...this.members.keys()]; }
  get groupCount(): number { return this.members.size; }
  /** Changes when membership or a member's versioned attributes change. */
  get version(): number { return this.revision; }

  /** Adds a group. Adding the same group twice is an error. */
  addGroup(group: InstancedGroup): void {
    if (this.members.has(group))
      throw new Error('group already in scene');
    this.members.set(group, group.onChange(this.changed));
    this.snapshot = undefined;
    this.changed();
  }

  /** Removes a group. Returns false if it was not in the scene. */
  removeGroup(group: InstancedGroup): boolean {
    const release = this.members.get(group);
    const removed = this.members.delete(group);
    if (removed) { release!(); this.snapshot = undefined; this.changed(); }
    return removed;
  }

  clear(): void {
    if (!this.members.size) return;
    for (const release of this.members.values()) release();
    this.members.clear();
    this.snapshot = undefined;
    this.changed();
  }
}
