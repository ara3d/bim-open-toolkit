/**
 * Deterministic instanced scenes shaped like the reference BIM model.
 *
 * The reference model has 456,598 rendered instances spread over 158,055
 * groups, so the average group holds under three instances and a handful of
 * groups hold hundreds. That shape matters: per-group work is paid 158,055
 * times, which is what makes bulk updates hard. The generator reproduces the
 * shape from a seed; it uses synthetic geometry and never reads model data.
 */
import { InstancedGroup, defaultMaterial, type MeshBuffers } from '@ara3d/viewer-core';
import { createRandom, distinctIntegers } from './prng.js';

/** Floats per instance transform (column-major 4x4). */
export const TRANSFORM_FLOATS = 16;
/** Floats per instance color (RGBA). */
export const COLOR_FLOATS = 4;

/** A triangle mesh of `vertices` positions, deterministic from the seed. */
export function syntheticMesh(vertices: number, seed: number): MeshBuffers {
  const random = createRandom(seed);
  const positions = new Float32Array(vertices * 3);
  for (let i = 0; i < positions.length; i++) positions[i] = random() * 2 - 1;
  const triangles = Math.max(1, Math.floor(vertices / 3));
  const indices = new Uint32Array(triangles * 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i % vertices;
  return { positions, indices };
}

/** How many instances, how many groups they are spread over, and how many distinct meshes. */
export interface SceneShape {
  readonly instances: number;
  readonly groups: number;
  readonly meshPool: number;
  readonly seed: number;
}

/** The reference model's counts. */
export const referenceShape: SceneShape = {
  instances: 456_598,
  groups: 158_055,
  meshPool: 64,
  seed: 11,
};

/**
 * Rendered instances per model object in the reference model: 456,598 instances
 * belong to 51,139 objects. A colour or transform change is asked for per object
 * and lands on nine rows on average.
 */
export const instancesPerObject = referenceShape.instances / 51_139;

/** The reference shape scaled to `instances`, keeping its instances-per-group ratio. */
export const scaledShape = (instances: number, seed = referenceShape.seed): SceneShape => ({
  instances,
  groups: Math.max(1, Math.round(instances * (referenceShape.groups / referenceShape.instances))),
  meshPool: referenceShape.meshPool,
  seed,
});

/**
 * Instances per group: one each, then a skewed tail so a few groups are large,
 * adjusted so the totals match the requested shape exactly.
 */
function groupSizes(shape: SceneShape): Int32Array {
  if (shape.instances < shape.groups) throw new Error('fewer instances than groups');
  const random = createRandom(shape.seed);
  const sizes = new Int32Array(shape.groups).fill(1);
  let remaining = shape.instances - shape.groups;
  for (let group = 0; group < shape.groups && remaining > 0; group++) {
    const draw = random();
    const extra = draw > 0.9995 ? 400 : draw > 0.99 ? 40 : draw > 0.6 ? 1 + Math.floor(random() * 4) : 0;
    const added = Math.min(extra, remaining);
    sizes[group] = (sizes[group] ?? 1) + added;
    remaining -= added;
  }
  for (let group = 0; remaining > 0; group = (group + 1) % shape.groups) {
    sizes[group] = (sizes[group] ?? 1) + 1;
    remaining--;
  }
  return sizes;
}

/** Groups plus the row index a columnar table needs: one row per rendered instance. */
export interface SyntheticScene {
  readonly shape: SceneShape;
  readonly groups: readonly InstancedGroup[];
  readonly rowCount: number;
  /** Group ordinal of each row. */
  readonly groupOf: Int32Array;
  /** Instance index inside that group, for each row. */
  readonly indexInGroup: Int32Array;
  /** Row of the first instance of each group. */
  readonly firstRowOf: Int32Array;
}

/** Builds the scene. Groups share a small pool of meshes so geometry memory stays bounded. */
export function createSyntheticScene(shape: SceneShape): SyntheticScene {
  const meshes = Array.from({ length: shape.meshPool }, (_, i) => syntheticMesh(8 + (i % 4) * 8, 100 + i));
  const sizes = groupSizes(shape);
  const random = createRandom(shape.seed + 1);
  const groups: InstancedGroup[] = [];
  const groupOf = new Int32Array(shape.instances);
  const indexInGroup = new Int32Array(shape.instances);
  const firstRowOf = new Int32Array(shape.groups);
  let row = 0;
  for (let g = 0; g < shape.groups; g++) {
    const count = sizes[g] ?? 1;
    const mesh = meshes[g % shape.meshPool] ?? meshes[0];
    if (!mesh) throw new Error('empty mesh pool');
    const group = new InstancedGroup(mesh, defaultMaterial, count);
    const transforms = new Float32Array(count * TRANSFORM_FLOATS);
    const colors = new Float32Array(count * COLOR_FLOATS);
    for (let i = 0; i < count; i++) {
      const t = i * TRANSFORM_FLOATS;
      transforms[t] = 1;
      transforms[t + 5] = 1;
      transforms[t + 10] = 1;
      transforms[t + 15] = 1;
      transforms[t + 12] = random() * 100;
      transforms[t + 13] = random() * 100;
      transforms[t + 14] = random() * 100;
      const c = i * COLOR_FLOATS;
      colors[c] = random();
      colors[c + 1] = random();
      colors[c + 2] = random();
      colors[c + 3] = 1;
      groupOf[row] = g;
      indexInGroup[row] = i;
      row++;
    }
    group.append(transforms, colors);
    firstRowOf[g] = row - count;
    groups.push(group);
  }
  return { shape, groups, rowCount: row, groupOf, indexInGroup, firstRowOf };
}

/** `fraction` of all rows, distinct, in random order. */
export const selectRows = (rowCount: number, fraction: number, seed: number): Int32Array =>
  distinctIntegers(Math.round(rowCount * fraction), rowCount, seed);

/** The same rows in ascending order, which visits each group's buffer once. */
export const sortRows = (rows: Int32Array): Int32Array => Int32Array.from(rows).sort();

/** The first `count` rows: the best case for locality. */
export const contiguousRows = (count: number, start = 0): Int32Array =>
  Int32Array.from({ length: count }, (_, i) => start + i);

/** Copies of every group's color and transform buffer, for restoring state between repetitions. */
export interface SceneSnapshot {
  readonly colors: readonly Float32Array[];
  readonly transforms: readonly Float32Array[];
}

/** Takes a snapshot backed by two flat arrays, so restoring allocates nothing. */
export function snapshotScene(scene: SyntheticScene): SceneSnapshot {
  const flatColors = new Float32Array(scene.rowCount * COLOR_FLOATS);
  const flatTransforms = new Float32Array(scene.rowCount * TRANSFORM_FLOATS);
  const colors: Float32Array[] = [];
  const transforms: Float32Array[] = [];
  let row = 0;
  for (const group of scene.groups) {
    const count = group.instanceCount;
    const colorSlice = flatColors.subarray(row * COLOR_FLOATS, (row + count) * COLOR_FLOATS);
    colorSlice.set(group.colors);
    colors.push(colorSlice);
    const transformSlice = flatTransforms.subarray(row * TRANSFORM_FLOATS, (row + count) * TRANSFORM_FLOATS);
    transformSlice.set(group.transforms);
    transforms.push(transformSlice);
    row += count;
  }
  return { colors, transforms };
}

/** Puts every group's buffers back to the snapshot. Not timed: call it from a case's setup. */
export function restoreScene(scene: SyntheticScene, snapshot: SceneSnapshot): void {
  for (let g = 0; g < scene.groups.length; g++) {
    const group = scene.groups[g];
    const colors = snapshot.colors[g];
    const transforms = snapshot.transforms[g];
    if (!group || !colors || !transforms) throw new Error('snapshot does not match the scene');
    group.colors.set(colors);
    group.transforms.set(transforms);
  }
}
