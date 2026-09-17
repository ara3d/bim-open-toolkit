import { MeshBuffers } from '../src/mesh-buffers.js';

export const triangle = (): MeshBuffers => ({
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  indices: new Uint32Array([0, 1, 2]),
});

export const identity = (): Float32Array =>
  new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export const translation = (x: number, y: number, z: number): Float32Array => {
  const m = identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
};

export const concat = (...arrays: Float32Array[]): Float32Array => {
  const out = new Float32Array(arrays.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
};

export const rgba = (r: number, g: number, b: number, a: number): Float32Array =>
  new Float32Array([r, g, b, a]);
