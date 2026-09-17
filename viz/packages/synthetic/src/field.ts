// A scalar field sampled on a regular grid, for heat maps and a bounds-only voxel preview.
//
// A cell nobody sampled reads NaN, never zero: a heat map that painted an unsampled cell at the
// bottom of its colour scale would be inventing a cold spot. The field therefore carries a block of
// cells that were never sampled at all - the corner of the floor the sensors did not reach - as
// well as scattered dropouts, and every statistic it reports is over the sampled cells only.
//
// The value is the sum of a few sources with a quadratic falloff plus a vertical gradient. That
// shape is arbitrary; what matters is that it uses multiplication and division only, so the field
// is bit-identical on every engine, which a field built out of sines would not be.

import {
  type Bounds,
  type CoordinateContext,
  type Vec3,
  metresZUpLocal,
} from '@bim-open-toolkit/model';
import { cursor as newCursor, drawChance, drawRange, type Cursor } from './cursor.js';

// The number of cells along each axis.
export type Dimensions = readonly [number, number, number];

// What to generate. `unsampledRate` is the share of cells that dropped out on their own, on top of
// the block nobody covered.
export type FieldOptions = {
  readonly seed: number;
  readonly dimensions: Dimensions;
  readonly spacing: Vec3;
  readonly origin: Vec3;
  readonly name: string;
  readonly unit: string;
  readonly unsampledRate: number;
  readonly gapScale: number;
};

// An operative temperature field over six floors of a 36 by 24 metre plate.
export const defaultFieldOptions: FieldOptions = {
  seed: 31,
  dimensions: [24, 16, 6],
  spacing: [1.5, 1.5, 3],
  origin: [0, 0, 1.2],
  name: 'operativeTemperature',
  unit: 'degC',
  unsampledRate: 0.04,
  gapScale: 1,
};

// A sampled field. `values` is in x-fastest order: index = x + nx * (y + ny * z). An unsampled cell
// is NaN. `bounds` is the box the samples occupy, which is what a voxel preview needs before any
// mesh exists.
export type ScalarField = {
  readonly options: FieldOptions;
  readonly name: string;
  readonly unit: string;
  readonly dimensions: Dimensions;
  readonly spacing: Vec3;
  readonly origin: Vec3;
  readonly coordinates: CoordinateContext;
  readonly values: Float32Array;
  readonly bounds: Bounds;
  readonly sampled: number;
  readonly minimum: number;
  readonly maximum: number;
  readonly mean: number;
};

// Rejects options that cannot produce a field.
function checkOptions(options: FieldOptions): void {
  if (!Number.isInteger(options.seed)) throw new Error(`seed must be an integer, got ${options.seed}`);
  for (const size of options.dimensions) {
    if (!Number.isInteger(size) || size < 2) throw new Error(`every dimension must be an integer of at least 2, got ${options.dimensions.join(', ')}`);
  }
  for (const step of options.spacing) {
    if (!(step > 0) || !Number.isFinite(step)) throw new Error(`every spacing must be a positive number, got ${options.spacing.join(', ')}`);
  }
  if (options.name === '') throw new Error('name must say what the field measures');
  if (!(options.unsampledRate >= 0) || options.unsampledRate > 1) throw new Error(`unsampledRate must be a share from 0 to 1, got ${options.unsampledRate}`);
  if (!(options.gapScale >= 0) || !Number.isFinite(options.gapScale)) throw new Error(`gapScale must be a finite number of at least 0, got ${options.gapScale}`);
}

// One source of the field: where it is, how strong it is and how quickly it falls away.
type Source = { readonly position: Vec3; readonly strength: number; readonly falloff: number };

// The index of a cell in the value array. X varies fastest, which is the order a renderer uploads.
export const cellIndex = (dimensions: Dimensions, x: number, y: number, z: number): number =>
  x + dimensions[0] * (y + dimensions[1] * z);

// The number of cells in the grid.
export const cellCount = (dimensions: Dimensions): number => dimensions[0] * dimensions[1] * dimensions[2];

// The centre of a cell in the field's own frame.
const cellCentre = (options: FieldOptions, x: number, y: number, z: number): Vec3 => [
  options.origin[0] + x * options.spacing[0],
  options.origin[1] + y * options.spacing[1],
  options.origin[2] + z * options.spacing[2],
];

// The value one source contributes at a point: strength over one plus the squared distance scaled
// by the falloff. Multiplication and division only, so the result is the same on every engine.
function contribution(source: Source, point: Vec3): number {
  const dx = point[0] - source.position[0];
  const dy = point[1] - source.position[1];
  const dz = point[2] - source.position[2];
  return source.strength / (1 + (dx * dx + dy * dy + dz * dz) / source.falloff);
}

// Generates a sampled field from its options. The same options always give the same values.
export function generateField(options: FieldOptions): ScalarField {
  checkOptions(options);
  const cursor: Cursor = newCursor(options.seed);
  const [nx, ny, nz] = options.dimensions;
  const extent: Vec3 = [(nx - 1) * options.spacing[0], (ny - 1) * options.spacing[1], (nz - 1) * options.spacing[2]];

  const sources: Source[] = [];
  for (let index = 0; index < 4; index++) {
    sources.push({
      position: [
        options.origin[0] + drawRange(cursor, 0, extent[0]),
        options.origin[1] + drawRange(cursor, 0, extent[1]),
        options.origin[2] + drawRange(cursor, 0, extent[2]),
      ],
      strength: drawRange(cursor, 2.5, 7),
      falloff: drawRange(cursor, 12, 60),
    });
  }

  // The corner nobody covered: a quarter of the plate on the lowest two levels was never sampled,
  // so a heat map has a hole in it rather than a cold spot.
  const uncoveredX = Math.max(1, Math.floor(nx / 4));
  const uncoveredY = Math.max(1, Math.floor(ny / 4));
  const uncoveredZ = Math.min(2, nz);
  const dropoutRate = options.unsampledRate * options.gapScale;

  const values = new Float32Array(cellCount(options.dimensions));
  let sampled = 0;
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  let total = 0;
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        // The dropout draw is made for every cell, so the uncovered corner does not shift the
        // sequence for the cells that follow it.
        const dropped = drawChance(cursor, dropoutRate);
        const uncovered = options.gapScale > 0 && x < uncoveredX && y < uncoveredY && z < uncoveredZ;
        const index = cellIndex(options.dimensions, x, y, z);
        if (dropped || uncovered) {
          values[index] = Number.NaN;
          continue;
        }
        const point = cellCentre(options, x, y, z);
        const ambient = 19 + (point[2] - options.origin[2]) / 12;
        const value = sources.reduce((sum, source) => sum + contribution(source, point), ambient);
        values[index] = value;
        sampled += 1;
        total += value;
        if (value < minimum) minimum = value;
        if (value > maximum) maximum = value;
      }
    }
  }

  return {
    options,
    name: options.name,
    unit: options.unit,
    dimensions: options.dimensions,
    spacing: options.spacing,
    origin: options.origin,
    coordinates: metresZUpLocal,
    values,
    bounds: {
      min: [
        options.origin[0] - options.spacing[0] / 2,
        options.origin[1] - options.spacing[1] / 2,
        options.origin[2] - options.spacing[2] / 2,
      ],
      max: [
        options.origin[0] + extent[0] + options.spacing[0] / 2,
        options.origin[1] + extent[1] + options.spacing[1] / 2,
        options.origin[2] + extent[2] + options.spacing[2] / 2,
      ],
    },
    sampled,
    minimum: sampled === 0 ? Number.NaN : minimum,
    maximum: sampled === 0 ? Number.NaN : maximum,
    mean: sampled === 0 ? Number.NaN : total / sampled,
  };
}
