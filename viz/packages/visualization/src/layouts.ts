import type { Matrix4, ObjectRecord, Vec3 } from './contracts.js';

export type LayoutCenter = (object: ObjectRecord, index: number) => Vec3;
export type ExplodeOptions = { readonly origin: Vec3; readonly strength: number; readonly centerOf: LayoutCenter };
export type GridOptions = { readonly origin: Vec3; readonly spacing: number; readonly columns: number; readonly centerOf: LayoutCenter };

const finite = (values: readonly number[]) => { if (!values.every(Number.isFinite)) throw new Error('Layout requires finite values'); };

/** Apply a world translation without replacing rotation/scale or changing the input matrix. */
function translate(object: ObjectRecord, delta: Vec3): ObjectRecord {
  finite([...object.transform, ...delta]);
  const matrix = [...object.transform];
  for (let column = 0; column < 4; column++) for (let axis = 0; axis < 3; axis++)
    matrix[column * 4 + axis] = matrix[column * 4 + axis]! + delta[axis]! * matrix[column * 4 + 3]!;
  finite(matrix);
  return { ...object, transform: Object.freeze(matrix) as unknown as Matrix4 };
}

/** Positive strength separates supplied world centers radially; zero restores the supplied base. */
export function explodeLayout(objects: readonly ObjectRecord[], options: ExplodeOptions): readonly ObjectRecord[] {
  finite([...options.origin, options.strength]);
  if (options.strength < 0) throw new Error('Explode strength must be nonnegative');
  return objects.map((object, index) => {
    const center = options.centerOf(object, index); finite(center);
    return translate(object, center.map((value, axis) => (value - options.origin[axis]!) * options.strength) as unknown as Vec3);
  });
}

/** Arrange supplied world centers on an XZ grid, retaining each object's internal placement. */
export function gridLayout(objects: readonly ObjectRecord[], options: GridOptions): readonly ObjectRecord[] {
  finite([...options.origin, options.spacing, options.columns]);
  if (options.spacing <= 0 || !Number.isInteger(options.columns) || options.columns < 1) throw new Error('Invalid layout grid');
  const rows = Math.ceil(objects.length / options.columns);
  return objects.map((object, index) => {
    const center = options.centerOf(object, index); finite(center);
    const target: Vec3 = [
      options.origin[0] + ((index % options.columns) - (Math.min(options.columns, objects.length) - 1) / 2) * options.spacing,
      options.origin[1],
      options.origin[2] + (Math.floor(index / options.columns) - (rows - 1) / 2) * options.spacing,
    ];
    return translate(object, target.map((value, axis) => value - center[axis]!) as unknown as Vec3);
  });
}
