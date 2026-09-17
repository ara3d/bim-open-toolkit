// What to point the camera at, when the model is a real one.
//
// A generated model is exactly as big as its building. A real one is not: Snowdon Towers is about
// five hundred metres across and carries a survey line five kilometres long, so framing the union
// of everything in it puts the building in a corner at a tenth of the height of the picture, which
// is what the gallery did before this file existed.
//
// Nothing is hidden by this. Every object is still in the scene, still pickable, still counted in
// the status strip; the opening camera simply frames the bulk of the model instead of its extremes,
// and says how many pieces it left outside the frame so a demo can report it.

import { emptyBounds, isEmptyBounds, unionBounds, type Bounds } from '@bim-open-toolkit/model';
import { groupBounds } from '@ara3d/viewer-core';
import type { SceneBinding } from '@bim-open-toolkit/render';

// A frame: what to look at, and what it does not cover.
export type Framing = {
  readonly bounds: Bounds;
  // Render groups whose centre fell outside the bulk of the model. Zero for a generated model.
  readonly outliers: number;
};

// The share of a model that "the bulk of it" means. One in a hundred groups may sit outside the
// opening frame; a real model's stray survey geometry is far below that share, and a model with no
// strays loses nothing, because the trim only ever drops groups that are already extreme.
export const bulkShare = 0.99;

const centerOf = (box: Bounds): readonly [number, number, number] => [
  (box.min[0] + box.max[0]) / 2,
  (box.min[1] + box.max[1]) / 2,
  (box.min[2] + box.max[2]) / 2,
];

// The value below which the given share of a sorted list falls.
const quantile = (sorted: readonly number[], share: number): number =>
  sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(share * (sorted.length - 1))))] ?? 0;

// Every render group's world box, which is what `SceneBinding.bounds` unions without looking.
export const groupBoxes = (binding: SceneBinding): readonly Bounds[] => {
  const boxes: Bounds[] = [];
  for (const model of binding.models)
    for (const group of model.table.groups) {
      const found = groupBounds(group);
      if (found !== null) boxes.push({ min: found.min, max: found.max });
    }
  return boxes;
};

// The bulk of a set of boxes: the union of those whose centre is inside the middle `share` of the
// centres on every axis. A model whose pieces are all together is returned whole.
export const bulkOf = (boxes: readonly Bounds[], share: number = bulkShare): Framing => {
  if (boxes.length === 0) return { bounds: emptyBounds, outliers: 0 };
  const margin = (1 - share) / 2;
  const limits = [0, 1, 2].map((axis) => {
    const centres = boxes.map((box) => centerOf(box)[axis] ?? 0).sort((a, b) => a - b);
    return { low: quantile(centres, margin), high: quantile(centres, 1 - margin) };
  });
  const inside = (box: Bounds): boolean =>
    limits.every((limit, axis) => {
      const centre = centerOf(box)[axis] ?? 0;
      return centre >= limit.low && centre <= limit.high;
    });
  let total = emptyBounds;
  let kept = 0;
  for (const box of boxes)
    if (inside(box)) {
      total = unionBounds(total, box);
      kept++;
    }
  // Every box an outlier, which happens when a model is a handful of pieces far apart: frame it all
  // rather than frame nothing.
  if (kept === 0 || isEmptyBounds(total)) {
    let whole = emptyBounds;
    for (const box of boxes) whole = unionBounds(whole, box);
    return { bounds: whole, outliers: 0 };
  }
  return { bounds: total, outliers: boxes.length - kept };
};

// What the opening camera frames, for the scene as it is bound now.
export const framingOf = (binding: SceneBinding, share: number = bulkShare): Framing =>
  bulkOf(groupBoxes(binding), share);
