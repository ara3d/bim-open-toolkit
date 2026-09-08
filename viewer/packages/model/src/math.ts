// A point or direction in two dimensions: a plan footprint, a texture coordinate, a screen point.
export type Vec2 = readonly [number, number];

// A point or direction in three dimensions.
export type Vec3 = readonly [number, number, number];

// Linear RGB in the range 0 to 1. Alpha is carried separately as opacity.
export type Color = readonly [number, number, number];

// A 4x4 affine transform stored column-major: element (row r, column c) is at index c * 4 + r.
export type Matrix4 = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

// An axis-aligned box. `min` greater than `max` on any axis means the box is empty.
export type Bounds = { readonly min: Vec3; readonly max: Vec3 };

// The transform that changes nothing.
export const identityMatrix: Matrix4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// A transform that moves by the given offset.
export const translation = (offset: Vec3): Matrix4 => [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  offset[0], offset[1], offset[2], 1,
];

// A transform that scales each axis independently about the origin.
export const scaling = (factors: Vec3): Matrix4 => [
  factors[0], 0, 0, 0,
  0, factors[1], 0, 0,
  0, 0, factors[2], 0,
  0, 0, 0, 1,
];

// The transform that applies `second` after `first`.
export const multiplyMatrix = (second: Matrix4, first: Matrix4): Matrix4 => {
  const [a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15] = second;
  const [b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15] = first;
  return [
    a0 * b0 + a4 * b1 + a8 * b2 + a12 * b3,
    a1 * b0 + a5 * b1 + a9 * b2 + a13 * b3,
    a2 * b0 + a6 * b1 + a10 * b2 + a14 * b3,
    a3 * b0 + a7 * b1 + a11 * b2 + a15 * b3,
    a0 * b4 + a4 * b5 + a8 * b6 + a12 * b7,
    a1 * b4 + a5 * b5 + a9 * b6 + a13 * b7,
    a2 * b4 + a6 * b5 + a10 * b6 + a14 * b7,
    a3 * b4 + a7 * b5 + a11 * b6 + a15 * b7,
    a0 * b8 + a4 * b9 + a8 * b10 + a12 * b11,
    a1 * b8 + a5 * b9 + a9 * b10 + a13 * b11,
    a2 * b8 + a6 * b9 + a10 * b10 + a14 * b11,
    a3 * b8 + a7 * b9 + a11 * b10 + a15 * b11,
    a0 * b12 + a4 * b13 + a8 * b14 + a12 * b15,
    a1 * b12 + a5 * b13 + a9 * b14 + a13 * b15,
    a2 * b12 + a6 * b13 + a10 * b14 + a14 * b15,
    a3 * b12 + a7 * b13 + a11 * b14 + a15 * b15,
  ];
};

// Transforms a point, including translation. Perspective division is not applied.
export const transformPoint = (matrix: Matrix4, point: Vec3): Vec3 => {
  const [x, y, z] = point;
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
};

// Transforms a direction, ignoring translation.
export const transformDirection = (matrix: Matrix4, direction: Vec3): Vec3 => {
  const [x, y, z] = direction;
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z,
    matrix[1] * x + matrix[5] * y + matrix[9] * z,
    matrix[2] * x + matrix[6] * y + matrix[10] * z,
  ];
};

// Sum of two vectors.
export const addVec3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// Difference of two vectors.
export const subVec3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// A vector scaled by a factor.
export const scaleVec3 = (v: Vec3, factor: number): Vec3 => [v[0] * factor, v[1] * factor, v[2] * factor];

// The cross product of two plane vectors: positive when b turns counter-clockwise from a, zero when
// they are parallel, and twice the signed area of the triangle they span.
export const crossVec2 = (a: Vec2, b: Vec2): number => a[0] * b[1] - a[1] * b[0];

// Twice the signed area of the triangle a, b, c: positive when it is wound counter-clockwise, zero
// when the three points are collinear. This is the orientation test a triangulator asks per corner.
export const turnVec2 = (a: Vec2, b: Vec2, c: Vec2): number =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

// The signed area of the closed polygon through the points, positive when they are counter-clockwise.
// A self-intersecting outline gives the sum of its signed parts, which is why it is not an area test.
export const polygonArea = (points: readonly Vec2[]): number => {
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const following = points[(index + 1) % points.length];
    if (current !== undefined && following !== undefined) total += crossVec2(current, following);
  }
  return total / 2;
};

// The box that contains nothing; unioning it with anything gives that thing.
export const emptyBounds: Bounds = {
  min: [Infinity, Infinity, Infinity],
  max: [-Infinity, -Infinity, -Infinity],
};

// True when the box contains no points.
export const isEmptyBounds = (bounds: Bounds): boolean =>
  bounds.min[0] > bounds.max[0] || bounds.min[1] > bounds.max[1] || bounds.min[2] > bounds.max[2];

// The smallest box containing the box and the point.
export const expandBounds = (bounds: Bounds, point: Vec3): Bounds => ({
  min: [
    Math.min(bounds.min[0], point[0]),
    Math.min(bounds.min[1], point[1]),
    Math.min(bounds.min[2], point[2]),
  ],
  max: [
    Math.max(bounds.max[0], point[0]),
    Math.max(bounds.max[1], point[1]),
    Math.max(bounds.max[2], point[2]),
  ],
});

// The smallest box containing both boxes. An empty box contributes nothing.
export const unionBounds = (a: Bounds, b: Bounds): Bounds =>
  isEmptyBounds(a)
    ? b
    : isEmptyBounds(b)
      ? a
      : {
          min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
          max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
        };

// The smallest box containing every point.
export const boundsOf = (points: Iterable<Vec3>): Bounds => {
  let bounds = emptyBounds;
  for (const point of points) bounds = expandBounds(bounds, point);
  return bounds;
};

// The middle of the box, or undefined when it is empty.
export const boundsCenter = (bounds: Bounds): Vec3 | undefined =>
  isEmptyBounds(bounds) ? undefined : scaleVec3(addVec3(bounds.min, bounds.max), 0.5);

// The extent of the box on each axis, or undefined when it is empty.
export const boundsSize = (bounds: Bounds): Vec3 | undefined =>
  isEmptyBounds(bounds) ? undefined : subVec3(bounds.max, bounds.min);

// True when the point is inside or on the box.
export const boundsContain = (bounds: Bounds, point: Vec3): boolean =>
  point[0] >= bounds.min[0] && point[0] <= bounds.max[0] &&
  point[1] >= bounds.min[1] && point[1] <= bounds.max[1] &&
  point[2] >= bounds.min[2] && point[2] <= bounds.max[2];

// The box containing every corner of the box after the transform.
export const transformBounds = (matrix: Matrix4, bounds: Bounds): Bounds =>
  isEmptyBounds(bounds)
    ? bounds
    : boundsOf(
        [0, 1, 2, 3, 4, 5, 6, 7].map((corner): Vec3 => {
          const source: Vec3 = [
            (corner & 1) === 0 ? bounds.min[0] : bounds.max[0],
            (corner & 2) === 0 ? bounds.min[1] : bounds.max[1],
            (corner & 4) === 0 ? bounds.min[2] : bounds.max[2],
          ];
          return transformPoint(matrix, source);
        }),
      );

// The length of a vector.
export const vec3Length = (v: Vec3): number => Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);

// The vector scaled to unit length, or undefined when it has no length to scale.
export const normalizeVec3 = (v: Vec3): Vec3 | undefined => {
  const size = vec3Length(v);
  return size === 0 ? undefined : scaleVec3(v, 1 / size);
};
