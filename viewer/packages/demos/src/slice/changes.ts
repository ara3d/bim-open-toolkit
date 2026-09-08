// Step three of the slice: turn two resolutions into the rows that actually have to be written.
// Pure.
//
// `resolveStyles` says how everything looks and `SceneBinding.applyStyles` writes all of it,
// leaving change detection to discard what did not move. A page that resolves on every click wants
// the smaller statement: the objects whose appearance differs between the resolution in force and
// the next one. That is a `Table` in the render package's own column vocabulary, so it applies with
// `SceneBinding.applyChanges` and no translation.
//
// Deletions are not expressed: this slice has no edit layers, so nothing is ever deleted.

import {
  boolColumn,
  f32Column,
  sameAppearance,
  stringColumn,
  styleOf,
  table,
  type ObjectKey,
  type ResolvedStyles,
  type Table,
} from '@bim-open-toolkit/model';
import { updateColumns } from '@bim-open-toolkit/render';

// The objects whose appearance differs between two resolutions, as a change table addressed by
// object key. An empty result still carries its columns, so applying it is valid and writes nothing.
export const styleChanges = (
  before: ResolvedStyles,
  after: ResolvedStyles,
  keys: Iterable<ObjectKey>,
): Table => {
  const changed: ObjectKey[] = [];
  const red: number[] = [];
  const green: number[] = [];
  const blue: number[] = [];
  const alpha: number[] = [];
  const visible: boolean[] = [];
  for (const key of keys) {
    const was = styleOf(before, key);
    const now = styleOf(after, key);
    if (sameAppearance(was, now)) continue;
    changed.push(key);
    red.push(now.color[0]);
    green.push(now.color[1]);
    blue.push(now.color[2]);
    alpha.push(now.opacity);
    visible.push(now.visible);
  }
  return table([
    [updateColumns.key, stringColumn(changed)],
    [updateColumns.red, f32Column(red)],
    [updateColumns.green, f32Column(green)],
    [updateColumns.blue, f32Column(blue)],
    [updateColumns.alpha, f32Column(alpha)],
    [updateColumns.visible, boolColumn(visible)],
  ]);
};
