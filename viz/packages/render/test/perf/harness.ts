// Timing and scene helpers for the render performance tests.
//
// Cases are warmed together and then timed in interleaved rounds, so a machine that slows down
// partway through slows every case rather than only the ones being measured at the time. The
// median is reported and the minimum and maximum are printed alongside, so a noisy run is visible.
// Assertions are on ratios between cases, never on absolute times, so they hold on a slower
// machine.
//
// This mirrors the protocol of the instance-update study in `@bim-open-toolkit/testing`. It is
// copied rather than imported because that package is another track's fence and is not a
// dependency of this one; the duplication is noted in docs/CHECKPOINT-R.md.

import {
  colorStride,
  modelIdentity,
  objectKey,
  transformStride,
  type Geometry,
  type Mesh,
  type ObjectKey,
} from '@bim-open-toolkit/model';
import { buildInstanceTable, type InstanceTable } from '../../src/instance-table.js';

// One measured case: untimed setup, then timed work that returns a number so it cannot be removed.
export type Case<S> = {
  readonly label: string;
  readonly setup: () => S;
  readonly body: (state: S) => number;
};

// What one case measured. Times are milliseconds.
export type Sample = {
  readonly label: string;
  readonly medianMs: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly repetitions: number;
};

// How many rounds to warm and to time.
export type MeasureOptions = { readonly repetitions: number; readonly warmups: number };

// Middle value, or the mean of the two middle values.
export const median = (values: readonly number[]): number => {
  if (values.length === 0) throw new Error('median of no values');
  const sorted = [...values].sort((a, b) => a - b);
  const half = sorted.length >> 1;
  if (sorted.length % 2 === 1) return sorted[half] ?? 0;
  return ((sorted[half - 1] ?? 0) + (sorted[half] ?? 0)) / 2;
};

// A case whose state type is hidden, so cases of different shapes are measured together.
export type Prepared = {
  readonly label: string;
  readonly warm: () => void;
  readonly timed: () => number;
};

// Hides a case's state type.
export const prepare = <S>(subject: Case<S>): Prepared => ({
  label: subject.label,
  warm: () => {
    subject.body(subject.setup());
  },
  timed: () => {
    const state = subject.setup();
    const start = performance.now();
    const guard = subject.body(state);
    const elapsed = performance.now() - start;
    return guard === Number.MIN_SAFE_INTEGER ? Number.NaN : elapsed;
  },
});

// Warms every case, then times them in interleaved rounds.
export const measureAll = (cases: readonly Prepared[], options: MeasureOptions): Sample[] => {
  const times = cases.map((): number[] => []);
  for (let round = 0; round < options.warmups; round++) for (const subject of cases) subject.warm();
  for (let round = 0; round < options.repetitions; round++)
    for (let i = 0; i < cases.length; i++) times[i]?.push(cases[i]?.timed() ?? 0);
  return cases.map((subject, i) => {
    const record = times[i] ?? [];
    return {
      label: subject.label,
      medianMs: median(record),
      minMs: Math.min(...record),
      maxMs: Math.max(...record),
      repetitions: options.repetitions,
    };
  });
};

// The sample with this label, or an error, so an assertion cannot pass by accident.
export const sampleFor = (samples: readonly Sample[], label: string): Sample => {
  const found = samples.find((sample) => sample.label === label);
  if (!found) throw new Error(`no sample labelled "${label}"`);
  return found;
};

// How many times slower one case is than another.
export const ratio = (slower: Sample, faster: Sample): number =>
  faster.medianMs === 0 ? Number.POSITIVE_INFINITY : slower.medianMs / faster.medianMs;

const round = (value: number): string => value.toFixed(value < 10 ? 3 : 1);

// Prints a titled table so a run leaves readable evidence.
export const reportSamples = (title: string, samples: readonly Sample[]): void => {
  const header = ['case', 'median ms', 'min ms', 'max ms', 'reps'];
  const rows = samples.map((sample) => [
    sample.label,
    round(sample.medianMs),
    round(sample.minMs),
    round(sample.maxMs),
    String(sample.repetitions),
  ]);
  const widths = header.map((title2, column) =>
    Math.max(title2.length, ...rows.map((row) => (row[column] ?? '').length)));
  const line = (cells: readonly string[]): string =>
    `| ${cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join(' | ')} |`;
  console.log(
    `\n${title}\n${[line(header), `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`, ...rows.map(line)].join('\n')}`,
  );
};

// A deterministic generator, so a run is reproducible.
export const random = (seed: number): (() => number) => {
  let state = (seed | 0) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_003) / 1_000_003;
  };
};

// `count` distinct values below `limit`, in scattered order.
export const distinctRows = (count: number, limit: number, seed: number): Int32Array => {
  const draw = random(seed);
  const taken = new Uint8Array(limit);
  const rows = new Int32Array(count);
  let found = 0;
  while (found < count) {
    const value = Math.min(limit - 1, Math.floor(draw() * limit));
    if (taken[value] === 1) continue;
    taken[value] = 1;
    rows[found++] = value;
  }
  return rows;
};

// The reference model's shape: 456,598 rendered instances over 158,055 groups and 51,139 objects,
// so a group holds under three instances and an object draws about nine of them. Per-group and
// per-object work is paid often, which is what makes bulk updates hard.
export const referenceRows = 456_598;
const referenceGroups = 158_055;
const referenceObjects = 51_139;

// The reference shape scaled to `rows`, keeping its instances-per-group and per-object ratios.
export const scaledShape = (rows: number): { readonly groups: number; readonly objects: number } => ({
  groups: Math.max(1, Math.round((rows * referenceGroups) / referenceRows)),
  objects: Math.max(1, Math.round((rows * referenceObjects) / referenceRows)),
});

const meshPool = (count: number): readonly Mesh[] =>
  Array.from({ length: count }, (_unused, index) => {
    const vertices = 8 + (index % 4) * 8;
    const draw = random(100 + index);
    const positions = new Float32Array(vertices * 3);
    for (let i = 0; i < positions.length; i++) positions[i] = draw() * 2 - 1;
    const indices = new Uint32Array(Math.max(1, Math.floor(vertices / 3)) * 3);
    for (let i = 0; i < indices.length; i++) indices[i] = i % vertices;
    return { positions, indices, bounds: { min: [-1, -1, -1], max: [1, 1, 1] } };
  });

const perfModel = modelIdentity({ id: 'render-perf', revision: '1' });

// A synthetic scene of the reference shape, built from columns without a per-instance object.
//
// Meshes are drawn from a pool of 64 distinct buffers and repeated by reference, so a scene of
// 158,055 groups costs 64 geometry allocations rather than 158,055.
export const perfScene = (
  rowCount: number,
  groupCount?: number,
): { geometry: Geometry; keys: readonly ObjectKey[] } => {
  const scaled = scaledShape(rowCount);
  const shape = groupCount === undefined ? scaled : { groups: groupCount, objects: scaled.objects };
  const pool = meshPool(64);
  const meshes = Array.from({ length: shape.groups }, (_unused, i) => pool[i % pool.length] ?? pool[0]);
  const draw = random(11);
  const meshIndex = new Int32Array(rowCount);
  const objectIndex = new Int32Array(rowCount);
  const transform = new Float32Array(rowCount * transformStride);
  const color = new Float32Array(rowCount * colorStride);
  // One row per group first, then a skewed tail, so a few groups are large and most are tiny.
  for (let row = 0; row < rowCount; row++) {
    const base = row < shape.groups ? row : Math.min(shape.groups - 1, Math.floor(draw() ** 3 * shape.groups));
    meshIndex[row] = base;
    objectIndex[row] = Math.min(shape.objects - 1, Math.floor((row / rowCount) * shape.objects));
    const t = row * transformStride;
    transform[t] = 1;
    transform[t + 5] = 1;
    transform[t + 10] = 1;
    transform[t + 15] = 1;
    transform[t + 12] = draw() * 100;
    transform[t + 13] = draw() * 100;
    transform[t + 14] = draw() * 100;
    const c = row * colorStride;
    color[c] = draw();
    color[c + 1] = draw();
    color[c + 2] = draw();
    color[c + 3] = 1;
  }
  const keys = Array.from({ length: shape.objects }, (_unused, i) =>
    objectKey({ modelId: perfModel.id, revision: perfModel.revision, objectId: `o${i}` }));
  return {
    geometry: {
      meshes: meshes.filter((item): item is Mesh => item !== undefined),
      instances: { count: rowCount, meshIndex, transform, color, objectIndex },
    },
    keys,
  };
};

// A built table plus the buffers needed to put it back the way it was between repetitions.
export type PerfTable = {
  readonly table: InstanceTable;
  readonly rowCount: number;
  // Restores every group's colours plus the opacity and visibility columns.
  readonly restoreColors: () => void;
  // Restores every group's transforms.
  readonly restoreTransforms: () => void;
};

// Builds the table and captures a restore point. Restoring allocates nothing.
export const perfTable = (rowCount: number, groupCount?: number): PerfTable => {
  const { geometry, keys } = perfScene(rowCount, groupCount);
  const result = buildInstanceTable(geometry, keys);
  if (!result.ok) throw new Error(result.diagnostics.map((item) => item.message).join('; '));
  const table = result.value;
  // Per-group copies, sliced once. Restoring from one flat array would need a subarray per group
  // per repetition, and 158,055 short-lived views per setup put a garbage collection inside the
  // timed body often enough to make medians meaningless.
  const colors = table.colors.map((buffer) => Float32Array.from(buffer));
  const transforms = table.transforms.map((buffer) => Float32Array.from(buffer));
  const opacity = Float32Array.from(table.opacity);
  const visible = Uint8Array.from(table.visible);
  const live = table.colors;
  const liveTransforms = table.transforms;
  return {
    table,
    rowCount: table.rowCount,
    restoreColors: () => {
      for (let g = 0; g < live.length; g++) {
        const source = colors[g];
        if (source !== undefined) live[g]?.set(source);
      }
      table.opacity.set(opacity);
      table.visible.set(visible);
    },
    restoreTransforms: () => {
      for (let g = 0; g < liveTransforms.length; g++) {
        const source = transforms[g];
        if (source !== undefined) liveTransforms[g]?.set(source);
      }
    },
  };
};
