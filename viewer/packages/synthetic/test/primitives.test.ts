import { describe, expect, it } from 'vitest';
import { triangleCount, vertexCount } from '../src/mesh-builder.js';
import { box, cylinder, extrude, plane, wedge } from '../src/primitives.js';
import { signedArea, triangulate } from '../src/triangulate.js';
import type { MeshData, Vector2, Vector3 } from '../src/shapes.js';

// Reads vertex `index` of a packed xyz array.
function readVector(values: Float32Array, index: number): Vector3 {
  const x = values[index * 3];
  const y = values[index * 3 + 1];
  const z = values[index * 3 + 2];
  if (x === undefined || y === undefined || z === undefined) throw new Error(`vertex ${index} is out of range`);
  return [x, y, z];
}

// Reads index `position` of the index buffer.
function readIndex(mesh: MeshData, position: number): number {
  const value = mesh.indices[position];
  if (value === undefined) throw new Error(`index ${position} is out of range`);
  return value;
}

// Every index addresses a vertex, every normal is unit length, and the bounds hold every position.
function checkWellFormed(mesh: MeshData): void {
  expect(mesh.positions.length % 3).toBe(0);
  expect(mesh.normals.length).toBe(mesh.positions.length);
  expect(mesh.indices.length % 3).toBe(0);
  const vertices = vertexCount(mesh);
  for (let position = 0; position < mesh.indices.length; position++) {
    const index = readIndex(mesh, position);
    expect(Number.isInteger(index)).toBe(true);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(vertices);
  }
  for (let index = 0; index < vertices; index++) {
    const normal = readVector(mesh.normals, index);
    expect(Math.hypot(...normal)).toBeCloseTo(1, 5);
    const point = readVector(mesh.positions, index);
    const axes = [
      [point[0], mesh.bounds.min[0], mesh.bounds.max[0]],
      [point[1], mesh.bounds.min[1], mesh.bounds.max[1]],
      [point[2], mesh.bounds.min[2], mesh.bounds.max[2]],
    ] as const;
    for (const [value, low, high] of axes) {
      expect(value).toBeGreaterThanOrEqual(low - 1e-6);
      expect(value).toBeLessThanOrEqual(high + 1e-6);
    }
  }
}

// The volume enclosed by the triangles, by the divergence theorem. A closed solid wound outward
// has a positive volume; one wound inward has the same value negated, so this checks the winding
// of every triangle at once.
function signedVolume(mesh: MeshData): number {
  let total = 0;
  for (let position = 0; position < mesh.indices.length; position += 3) {
    const a = readVector(mesh.positions, readIndex(mesh, position));
    const b = readVector(mesh.positions, readIndex(mesh, position + 1));
    const c = readVector(mesh.positions, readIndex(mesh, position + 2));
    total +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return total;
}

// Every triangle's normals agree with the direction its winding faces.
function checkNormalsFaceOutward(mesh: MeshData): void {
  for (let position = 0; position < mesh.indices.length; position += 3) {
    const a = readVector(mesh.positions, readIndex(mesh, position));
    const b = readVector(mesh.positions, readIndex(mesh, position + 1));
    const c = readVector(mesh.positions, readIndex(mesh, position + 2));
    const u: Vector3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v: Vector3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const facing: Vector3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const offset of [0, 1, 2]) {
      const normal = readVector(mesh.normals, readIndex(mesh, position + offset));
      expect(facing[0] * normal[0] + facing[1] * normal[1] + facing[2] * normal[2]).toBeGreaterThan(0);
    }
  }
}

describe('primitives', () => {
  it('builds a box with six flat faces', () => {
    const mesh = box([2, 4, 6]);
    checkWellFormed(mesh);
    checkNormalsFaceOutward(mesh);
    expect(triangleCount(mesh)).toBe(12);
    expect(vertexCount(mesh)).toBe(24);
    expect(mesh.bounds).toEqual({ min: [-1, -2, -3], max: [1, 2, 3] });
    expect(signedVolume(mesh)).toBeCloseTo(48, 4);
  });

  it('builds a cylinder that approaches its analytic volume as segments rise', () => {
    for (const segments of [3, 8, 64]) {
      const mesh = cylinder(2, 5, segments);
      checkWellFormed(mesh);
      checkNormalsFaceOutward(mesh);
      expect(triangleCount(mesh)).toBe(4 * segments);
      expect(mesh.bounds.min[1]).toBeCloseTo(-2.5, 5);
      expect(mesh.bounds.max[1]).toBeCloseTo(2.5, 5);
      const inscribed = 0.5 * segments * Math.sin((2 * Math.PI) / segments) * 4 * 5;
      expect(signedVolume(mesh)).toBeCloseTo(inscribed, 3);
    }
    expect(signedVolume(cylinder(2, 5, 256))).toBeCloseTo(Math.PI * 4 * 5, 1);
  });

  it('builds a plane as one upward-facing quad', () => {
    const mesh = plane(3, 7);
    checkWellFormed(mesh);
    expect(triangleCount(mesh)).toBe(2);
    expect(mesh.bounds).toEqual({ min: [-1.5, 0, -3.5], max: [1.5, 0, 3.5] });
    for (let index = 0; index < vertexCount(mesh); index++) expect(readVector(mesh.normals, index)).toEqual([0, 1, 0]);
  });

  it('builds a wedge of half the box volume', () => {
    const mesh = wedge([2, 3, 4]);
    checkWellFormed(mesh);
    checkNormalsFaceOutward(mesh);
    expect(triangleCount(mesh)).toBe(8);
    expect(mesh.bounds).toEqual({ min: [-1, -1.5, -2], max: [1, 1.5, 2] });
    expect(signedVolume(mesh)).toBeCloseTo((2 * 3 * 4) / 2, 4);
  });

  it('extrudes a convex footprint', () => {
    const square: readonly Vector2[] = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ];
    const mesh = extrude(square, 3);
    checkWellFormed(mesh);
    checkNormalsFaceOutward(mesh);
    expect(triangleCount(mesh)).toBe(2 * 2 + 4 * 2);
    expect(mesh.bounds).toEqual({ min: [0, -1.5, 0], max: [4, 1.5, 4] });
    expect(signedVolume(mesh)).toBeCloseTo(48, 4);
  });

  it('extrudes a concave footprint and ignores the winding it is given', () => {
    const el: readonly Vector2[] = [
      [0, 0],
      [6, 0],
      [6, 2],
      [2, 2],
      [2, 6],
      [0, 6],
    ];
    const mesh = extrude(el, 2);
    checkWellFormed(mesh);
    checkNormalsFaceOutward(mesh);
    expect(triangleCount(mesh)).toBe(4 * 2 + 6 * 2);
    expect(signedVolume(mesh)).toBeCloseTo(20 * 2, 4);
    const reversed = extrude([...el].reverse(), 2);
    expect(signedVolume(reversed)).toBeCloseTo(signedVolume(mesh), 4);
    expect([...reversed.positions]).toEqual([...mesh.positions]);
  });

  it('rejects degenerate inputs', () => {
    expect(() => box([0, 1, 1])).toThrow();
    expect(() => box([1, -1, 1])).toThrow();
    expect(() => cylinder(1, 1, 2)).toThrow();
    expect(() => cylinder(1, 1, 8.5)).toThrow();
    expect(() => cylinder(0, 1, 8)).toThrow();
    expect(() => plane(1, 0)).toThrow();
    expect(() => wedge([1, 1, 0])).toThrow();
    expect(() =>
      extrude(
        [
          [0, 0],
          [1, 0],
        ],
        1,
      ),
    ).toThrow();
    expect(() =>
      extrude(
        [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
        1,
      ),
    ).toThrow();
  });
});

describe('triangulate', () => {
  it('measures signed area with sign for winding', () => {
    const square: readonly Vector2[] = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    expect(signedArea(square)).toBe(4);
    expect(signedArea([...square].reverse())).toBe(-4);
  });

  it('covers a concave polygon exactly once', () => {
    const el: readonly Vector2[] = [
      [0, 0],
      [6, 0],
      [6, 2],
      [2, 2],
      [2, 6],
      [0, 6],
    ];
    const triangles = triangulate(el);
    expect(triangles.length).toBe(el.length - 2);
    const area = triangles.reduce((total, triangle) => {
      const points = triangle.map((index) => {
        const point = el[index];
        if (point === undefined) throw new Error('index out of range');
        return point;
      });
      return total + signedArea(points);
    }, 0);
    expect(area).toBeCloseTo(signedArea(el), 10);
    for (const triangle of triangles) expect(new Set(triangle).size).toBe(3);
  });

  it('rejects a self-intersecting outline', () => {
    expect(() =>
      triangulate([
        [0, 0],
        [4, 4],
        [4, 0],
        [0, 4],
      ]),
    ).toThrow();
  });
});
