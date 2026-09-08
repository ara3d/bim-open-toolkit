// Temporary local stand-ins for the geometry contracts owned by @bim-open-toolkit/model.
//
// Track M had not published revision `M1-stub` when this package needed them. These are the
// smallest structural types the generators require. They are deliberately absent from
// `src/index.ts`, so replacing them with the model imports is a change to this file alone.

// A point or direction in the XZ plane, as (x, z).
export type Vector2 = readonly [number, number];

// A point or direction in three dimensions, as (x, y, z).
export type Vector3 = readonly [number, number, number];

// An axis-aligned box given by its lowest and highest corner.
export type Bounds3 = { readonly min: Vector3; readonly max: Vector3 };

// A triangle mesh as plain data: three floats per vertex position and normal, three indices per
// triangle, and the axis-aligned bounds of the positions.
export type MeshData = {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly bounds: Bounds3;
};

// The bounds of nothing: an empty box that any union with a real point replaces.
export const emptyBounds: Bounds3 = {
  min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
  max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
};

// The smallest box containing both boxes.
export const unionBounds = (a: Bounds3, b: Bounds3): Bounds3 => ({
  min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
  max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
});

// The box a point extends the given box to.
export const growBounds = (bounds: Bounds3, point: Vector3): Bounds3 => unionBounds(bounds, { min: point, max: point });

// True when the box contains no point, which is the state of `emptyBounds`.
export const isEmptyBounds = (bounds: Bounds3): boolean =>
  bounds.min[0] > bounds.max[0] || bounds.min[1] > bounds.max[1] || bounds.min[2] > bounds.max[2];
