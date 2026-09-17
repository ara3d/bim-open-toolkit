/**
 * Columnar world bounds.
 *
 * The alpha computes scene bounds by allocating a `Bounds3` object, two tuple
 * arrays and a subarray per instance, and by recomputing each group's local
 * mesh box on every call. This module does the same arithmetic with every box
 * held as six numbers inside one array, so a whole model's boxes are one
 * allocation and a recomputation allocates nothing. It exists to measure the
 * difference, and to measure what recomputing only the changed groups saves.
 *
 * A box is six consecutive numbers: min x, y, z then max x, y, z.
 */
import type { InstancedGroup } from '@ara3d/viewer-core';
import { TRANSFORM_FLOATS } from './scene.js';

/** Numbers per box. */
export const BOX_NUMBERS = 6;

/** `count` boxes, every one empty (min +Infinity, max -Infinity). */
export function emptyBoxes(count: number): Float64Array {
  const boxes = new Float64Array(count * BOX_NUMBERS);
  for (let i = 0; i < count; i++) {
    boxes[i * BOX_NUMBERS] = Infinity;
    boxes[i * BOX_NUMBERS + 1] = Infinity;
    boxes[i * BOX_NUMBERS + 2] = Infinity;
    boxes[i * BOX_NUMBERS + 3] = -Infinity;
    boxes[i * BOX_NUMBERS + 4] = -Infinity;
    boxes[i * BOX_NUMBERS + 5] = -Infinity;
  }
  return boxes;
}

/** Writes the box of `positions` (x, y, z triples) into `boxes` at `box`. */
export function writePositionBox(boxes: Float64Array, box: number, positions: Float32Array): void {
  const at = box * BOX_NUMBERS;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i + 2 < positions.length; i += 3) {
    const x = positions[i] ?? 0, y = positions[i + 1] ?? 0, z = positions[i + 2] ?? 0;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }
  boxes[at] = minX; boxes[at + 1] = minY; boxes[at + 2] = minZ;
  boxes[at + 3] = maxX; boxes[at + 4] = maxY; boxes[at + 5] = maxZ;
}

/** The local box of each group's mesh, one box per group. */
export function localBoxes(groups: readonly InstancedGroup[]): Float64Array {
  const boxes = emptyBoxes(groups.length);
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    if (!group) throw new Error('missing group');
    writePositionBox(boxes, g, group.mesh.positions);
  }
  return boxes;
}

/**
 * Grows the box at `target` to include `local` placed by the column-major
 * affine matrix starting at `offset` in `transforms`. Visits three axes rather
 * than eight corners, the same trick the alpha uses.
 */
export function expandByInstance(
  target: Float64Array,
  targetBox: number,
  local: Float64Array,
  localBox: number,
  transforms: Float32Array,
  offset: number,
): void {
  const t = targetBox * BOX_NUMBERS;
  const l = localBox * BOX_NUMBERS;
  for (let axis = 0; axis < 3; axis++) {
    let low = transforms[offset + 12 + axis] ?? 0;
    let high = low;
    for (let j = 0; j < 3; j++) {
      const m = transforms[offset + j * 4 + axis] ?? 0;
      const a = m * (local[l + j] ?? 0);
      const b = m * (local[l + 3 + j] ?? 0);
      low += a < b ? a : b;
      high += a < b ? b : a;
    }
    if (low < (target[t + axis] ?? Infinity)) target[t + axis] = low;
    if (high > (target[t + 3 + axis] ?? -Infinity)) target[t + 3 + axis] = high;
  }
}

/** Recomputes the world box of each listed group from its instances. Allocates nothing. */
export function recomputeGroupBoxes(
  world: Float64Array,
  local: Float64Array,
  groups: readonly InstancedGroup[],
  which: Int32Array,
): number {
  for (let k = 0; k < which.length; k++) {
    const g = which[k] ?? 0;
    const group = groups[g];
    if (!group) throw new Error(`group ${g} out of range`);
    const at = g * BOX_NUMBERS;
    world[at] = Infinity; world[at + 1] = Infinity; world[at + 2] = Infinity;
    world[at + 3] = -Infinity; world[at + 4] = -Infinity; world[at + 5] = -Infinity;
    const transforms = group.transforms;
    for (let offset = 0; offset < transforms.length; offset += TRANSFORM_FLOATS)
      expandByInstance(world, g, local, g, transforms, offset);
  }
  return which.length;
}

/** The union of every box, written into six numbers. Returns the number of boxes read. */
export function unionBoxes(boxes: Float64Array, out: Float64Array): number {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let at = 0; at + 5 < boxes.length; at += BOX_NUMBERS) {
    const a = boxes[at] ?? Infinity, b = boxes[at + 1] ?? Infinity, c = boxes[at + 2] ?? Infinity;
    const d = boxes[at + 3] ?? -Infinity, e = boxes[at + 4] ?? -Infinity, f = boxes[at + 5] ?? -Infinity;
    if (a < minX) minX = a;
    if (b < minY) minY = b;
    if (c < minZ) minZ = c;
    if (d > maxX) maxX = d;
    if (e > maxY) maxY = e;
    if (f > maxZ) maxZ = f;
  }
  out[0] = minX; out[1] = minY; out[2] = minZ;
  out[3] = maxX; out[4] = maxY; out[5] = maxZ;
  return boxes.length / BOX_NUMBERS;
}

/** Every group ordinal, for a full recomputation. */
export const allGroups = (count: number): Int32Array =>
  Int32Array.from({ length: count }, (_, i) => i);

/** The distinct groups holding the listed rows, ascending. */
export function groupsOfRows(groupOf: Int32Array, rows: Int32Array): Int32Array {
  const seen = new Set<number>();
  for (const row of rows) seen.add(groupOf[row] ?? 0);
  return Int32Array.from(seen).sort();
}
