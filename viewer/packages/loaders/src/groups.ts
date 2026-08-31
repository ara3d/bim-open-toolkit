import { InstancedGroup } from '@ara3d/viewer-core';

/** Outcome of converting a source model into viewer-core groups. */
export interface ConvertResult {
  readonly groups: readonly InstancedGroup[];
  /** Total instances across all groups. */
  readonly instanceCount: number;
}

/**
 * Called once per finished group, in production order, so callers can add
 * groups to a scene incrementally instead of waiting for the whole model.
 * `index` is 0-based; `total` is the number of groups that will be produced.
 */
export type GroupCallback = (
  group: InstancedGroup,
  index: number,
  total: number,
) => void;
