import { describe, it, expect } from 'vitest';
import { vertexCount, triangleCount, validateMeshBuffers } from '../src/mesh-buffers.js';
import { triangle } from './helpers.js';

describe('MeshBuffers', () => {
  it('counts vertices and triangles', () => {
    const m = triangle();
    expect(vertexCount(m)).toBe(3);
    expect(triangleCount(m)).toBe(1);
  });

  it('counts triangles for non-indexed meshes', () => {
    const m = { positions: new Float32Array(9 * 2) };
    expect(triangleCount(m)).toBe(2);
  });

  it('validates a well-formed mesh', () => {
    expect(() => validateMeshBuffers(triangle())).not.toThrow();
  });

  it('rejects positions not a multiple of 3', () => {
    expect(() => validateMeshBuffers({ positions: new Float32Array(4) })).toThrow(/multiple of 3/);
  });

  it('rejects mismatched normals length', () => {
    expect(() =>
      validateMeshBuffers({ positions: new Float32Array(9), normals: new Float32Array(6) }),
    ).toThrow(/normals/);
  });

  it('rejects out-of-range indices', () => {
    expect(() =>
      validateMeshBuffers({ positions: new Float32Array(9), indices: new Uint32Array([0, 1, 3]) }),
    ).toThrow(/out of range/);
  });
});
